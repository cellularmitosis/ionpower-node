// event_loop.cpp — a real I/O-aware event loop for ionpower-node.
//
// Design
// ------
// SM45 has no built-in event loop. Sessions F/G/H got by with a JS-side
// __timer_queue__ that main.cpp drained synchronously after the entry
// script returned — ordering-correct but no wallclock sleep, no async
// I/O. This file replaces that drain with a real select()-based event
// loop:
//
//   while (hasPendingWork):
//     t = nextTimerFireAt - now               // ms until next timer
//     select(readFds, writeFds, t)            // may block
//     if SIGCHLD: reap children via waitpid(WNOHANG)
//     fire readable/writable watcher callbacks
//     fire due timers
//
// "Pending work" = any timer queued, any fd watcher, any registered
// child waiting on exit.
//
// Rooting strategy
// ----------------
// Watcher callbacks and child-exit callbacks are stored in JS-side
// objects (`__event_loop_watcher_cbs__`, `__event_loop_child_cbs__`),
// keyed by numeric id/pid. The C++ side holds only (id, fd, events)
// tuples — no raw JSObject* pointers that would need C++ rooting. The
// loop calls `__event_loop_fire_watcher__(id)` / `__event_loop_fire_child__(pid, code, sig)`
// to invoke callbacks, letting SM's normal reachability keep them
// alive via property lookup.

#include "node_compat/globals.h"

#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/select.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include <string>
#include <vector>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// ---- Globals (singletons per process) -------------------------------

static volatile sig_atomic_t g_sigchld_seen = 0;

struct Watcher {
    int id;
    int fd;
    int events;            // bitmask: 1 = readable, 2 = writable
    bool alive;
};
static std::vector<Watcher> g_watchers;
static int g_next_watcher_id = 1;

struct Child {
    pid_t pid;
    bool alive;
};
static std::vector<Child> g_children;

// ---- SIGCHLD plumbing ------------------------------------------------

static void SigchldHandler(int /*sig*/) {
    g_sigchld_seen = 1;
}

static void InstallSigchldHandler() {
    static bool installed = false;
    if (installed) return;
    installed = true;
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = SigchldHandler;
    sigemptyset(&sa.sa_mask);
    // No SA_RESTART — we WANT select() to wake with EINTR on SIGCHLD
    // so the loop observes and reacts.
    sa.sa_flags = SA_NOCLDSTOP;
    sigaction(SIGCHLD, &sa, nullptr);
}

// ---- "Now" in milliseconds -----------------------------------------

static double NowMs() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (double)tv.tv_sec * 1000.0 + (double)tv.tv_usec / 1000.0;
}

// ---- Watcher / child registry --------------------------------------

static void CompactWatchers() {
    size_t w = 0;
    for (size_t r = 0; r < g_watchers.size(); ++r) {
        if (g_watchers[r].alive) {
            if (r != w) g_watchers[w] = g_watchers[r];
            ++w;
        }
    }
    g_watchers.resize(w);
}

static void CompactChildren() {
    size_t w = 0;
    for (size_t r = 0; r < g_children.size(); ++r) {
        if (g_children[r].alive) {
            if (r != w) g_children[w] = g_children[r];
            ++w;
        }
    }
    g_children.resize(w);
}

// ---- JS-callable native bindings ------------------------------------

// ioWatch(fd, events) -> id. The JS caller stashes the callback in
// __event_loop_watcher_cbs__[id] before returning from the JS wrapper.
static bool JsIoWatch(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "ioWatch(fd, events): 2 args required");
        return false;
    }
    int32_t fd = 0, events = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    if (!JS::ToInt32(cx, args[1], &events)) return false;
    int id = g_next_watcher_id++;
    Watcher w = { id, fd, events, true };
    g_watchers.push_back(w);
    args.rval().setInt32(id);
    return true;
}

static bool JsIoUnwatch(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t id = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &id)) {
        for (size_t i = 0; i < g_watchers.size(); ++i) {
            if (g_watchers[i].id == id) { g_watchers[i].alive = false; break; }
        }
    }
    args.rval().setUndefined();
    return true;
}

static bool JsChildRegister(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "childRegister(pid): 1 arg required");
        return false;
    }
    int32_t pid = 0;
    if (!JS::ToInt32(cx, args[0], &pid)) return false;
    InstallSigchldHandler();
    Child c = { (pid_t)pid, true };
    g_children.push_back(c);
    args.rval().setUndefined();
    return true;
}

static bool JsChildUnregister(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t pid = 0;
    if (args.length() >= 1 && JS::ToInt32(cx, args[0], &pid)) {
        for (size_t i = 0; i < g_children.size(); ++i) {
            if (g_children[i].pid == (pid_t)pid) {
                g_children[i].alive = false;
                break;
            }
        }
    }
    args.rval().setUndefined();
    return true;
}

static bool JsNowMs(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setNumber(NowMs());
    return true;
}

// ---- Fire callbacks via JS-side trampoline -------------------------

// Call a JS function on global by name, with optional numeric args.
static void CallGlobalFn(JSContext* cx, JS::HandleObject global,
                         const char* name,
                         unsigned nargs, const double* nargsv)
{
    JS::RootedValue fnv(cx);
    if (!JS_GetProperty(cx, global, name, &fnv)) return;
    if (!fnv.isObject() || !JS_ObjectIsFunction(cx, &fnv.toObject())) return;
    JS::AutoValueVector argv(cx);
    for (unsigned i = 0; i < nargs; ++i) argv.append(JS::NumberValue(nargsv[i]));
    JS::RootedValue rv(cx);
    if (!JS::Call(cx, global, fnv,
                  JS::HandleValueArray::fromMarkedLocation(nargs, argv.begin()),
                  &rv)) {
        if (JS_IsExceptionPending(cx)) JS_ReportPendingException(cx);
    }
}

// Drain the JS-side microtask queue (Promise .then callbacks, queueMicrotask,
// process.nextTick). Safe to call with no pending microtasks.
static void DrainMicrotasks(JSContext* cx, JS::HandleObject global) {
    JS::RootedValue fnv(cx);
    if (!JS_GetProperty(cx, global, "__drain_microtasks__", &fnv)) return;
    if (!fnv.isObject() || !JS_ObjectIsFunction(cx, &fnv.toObject())) return;
    JS::RootedValue rv(cx);
    if (!JS::Call(cx, global, fnv, JS::HandleValueArray::empty(), &rv)) {
        if (JS_IsExceptionPending(cx)) JS_ReportPendingException(cx);
    }
}

// Reap any child that has exited and fire its JS callback via
// __event_loop_fire_child__(pid, exitCode, signal). JS-side callback
// table does the rest (emit 'exit' / 'close' on the ChildProcess, etc).
static void ReapChildren(JSContext* cx, JS::HandleObject global) {
    while (true) {
        int status = 0;
        pid_t p = waitpid(-1, &status, WNOHANG);
        if (p <= 0) break;
        // Mark our record dead
        for (size_t i = 0; i < g_children.size(); ++i) {
            if (g_children[i].pid == p) { g_children[i].alive = false; break; }
        }
        // Fire JS callback. Pass (pid, exitCode|-1, signalNum|0).
        double exitCode = -1, signalNum = 0;
        if (WIFEXITED(status)) { exitCode = WEXITSTATUS(status); signalNum = 0; }
        else if (WIFSIGNALED(status)) { exitCode = -1; signalNum = WTERMSIG(status); }
        double args[3] = { (double)p, exitCode, signalNum };
        CallGlobalFn(cx, global, "__event_loop_fire_child__", 3, args);
    }
    CompactChildren();
}

static double QueryNextTimerFireAt(JSContext* cx, JS::HandleObject global) {
    JS::RootedValue fnv(cx);
    if (!JS_GetProperty(cx, global, "__get_next_timer_fireat__", &fnv)) return 1e300;
    if (!fnv.isObject() || !JS_ObjectIsFunction(cx, &fnv.toObject())) return 1e300;
    JS::RootedValue rv(cx);
    if (!JS::Call(cx, global, fnv, JS::HandleValueArray::empty(), &rv)) {
        if (JS_IsExceptionPending(cx)) JS_ClearPendingException(cx);
        return 1e300;
    }
    if (!rv.isNumber()) return 1e300;
    return rv.toNumber();
}

static void FireDueTimers(JSContext* cx, JS::HandleObject global) {
    double nowArg[1] = { NowMs() };
    CallGlobalFn(cx, global, "__fire_due_timers__", 1, nowArg);
}

static int QueryTimerCount(JSContext* cx, JS::HandleObject global) {
    JS::RootedValue fnv(cx);
    if (!JS_GetProperty(cx, global, "__active_timer_count__", &fnv)) return 0;
    if (!fnv.isObject() || !JS_ObjectIsFunction(cx, &fnv.toObject())) return 0;
    JS::RootedValue rv(cx);
    if (!JS::Call(cx, global, fnv, JS::HandleValueArray::empty(), &rv)) {
        if (JS_IsExceptionPending(cx)) JS_ClearPendingException(cx);
        return 0;
    }
    if (!rv.isNumber()) return 0;
    return (int)rv.toNumber();
}

// ---- The loop ------------------------------------------------------

bool RunEventLoop(JSContext* cx, JS::HandleObject global) {
    while (true) {
        CompactWatchers();
        CompactChildren();

        bool anyTimer = QueryTimerCount(cx, global) > 0;
        bool anyWatcher = !g_watchers.empty();
        bool anyChild = !g_children.empty();

        if (!anyTimer && !anyWatcher && !anyChild) break;

        struct timeval tv;
        struct timeval* tvp = nullptr;
        if (anyTimer) {
            double next = QueryNextTimerFireAt(cx, global);
            double now = NowMs();
            double delta = next - now;
            if (delta < 0) delta = 0;
            long us = (long)(delta * 1000.0);
            tv.tv_sec = us / 1000000;
            tv.tv_usec = us % 1000000;
            tvp = &tv;
        } else if (!anyWatcher && anyChild) {
            // No timers, no fd watchers — block indefinitely on SIGCHLD.
            tvp = nullptr;
        } else {
            tvp = nullptr;
        }

        fd_set readFds, writeFds;
        FD_ZERO(&readFds);
        FD_ZERO(&writeFds);
        int maxFd = -1;
        for (size_t i = 0; i < g_watchers.size(); ++i) {
            const Watcher& w = g_watchers[i];
            if (!w.alive) continue;
            if (w.events & 1) { FD_SET(w.fd, &readFds);  if (w.fd > maxFd) maxFd = w.fd; }
            if (w.events & 2) { FD_SET(w.fd, &writeFds); if (w.fd > maxFd) maxFd = w.fd; }
        }

        int n = select(maxFd + 1, &readFds, &writeFds, nullptr, tvp);
        int sel_errno = errno;

        if (g_sigchld_seen) {
            g_sigchld_seen = 0;
            ReapChildren(cx, global);
            DrainMicrotasks(cx, global);
        }

        if (n < 0 && sel_errno != EINTR) {
            fprintf(stderr, "[ionpower] select() errno %d: %s\n",
                    sel_errno, strerror(sel_errno));
            break;
        }

        if (n > 0) {
            // Snapshot ids we need to fire.
            std::vector<int> toFire;
            for (size_t i = 0; i < g_watchers.size(); ++i) {
                const Watcher& w = g_watchers[i];
                if (!w.alive) continue;
                bool readable = (w.events & 1) && FD_ISSET(w.fd, &readFds);
                bool writable = (w.events & 2) && FD_ISSET(w.fd, &writeFds);
                if (readable || writable) toFire.push_back(w.id);
            }
            for (size_t i = 0; i < toFire.size(); ++i) {
                double arg = (double)toFire[i];
                CallGlobalFn(cx, global, "__event_loop_fire_watcher__", 1, &arg);
                DrainMicrotasks(cx, global);
            }
        }

        if (anyTimer) {
            FireDueTimers(cx, global);
            DrainMicrotasks(cx, global);
        }
    }
    return true;
}

// ---- Install -------------------------------------------------------

bool InstallEventLoop(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject ev(cx, JS_NewPlainObject(cx));
    if (!ev) return false;
    if (!JS_DefineFunction(cx, ev, "ioWatch",         JsIoWatch,        2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, ev, "ioUnwatch",       JsIoUnwatch,      1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, ev, "childRegister",   JsChildRegister,  1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, ev, "childUnregister", JsChildUnregister,1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, ev, "nowMs",           JsNowMs,          0, JSPROP_ENUMERATE)) return false;

    JS::RootedValue rV(cx, JS::Int32Value(1));
    JS::RootedValue wV(cx, JS::Int32Value(2));
    JS::RootedValue rwV(cx, JS::Int32Value(3));
    if (!JS_DefineProperty(cx, ev, "READABLE",  rV,  JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, ev, "WRITABLE",  wV,  JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, ev, "READWRITE", rwV, JSPROP_ENUMERATE)) return false;

    return JS_DefineProperty(cx, global, "__event_loop_native__", ev,
                             JSPROP_ENUMERATE);
}

} // namespace ionpower
