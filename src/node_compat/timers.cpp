// Timers + minimal event loop.
//
// SpiderMonkey 45 doesn't give us a usable native event loop, so we
// implement one in JS: setTimeout / setImmediate / setInterval enqueue
// {id, fn, args, fireAt, interval?} records into a per-runtime queue
// stashed on the global as `__timer_queue__`. Cleared-by-id records
// get marked with `cleared=true` and skipped at drain time.
//
// `__drain_timers__()` is called from main.cpp after the entry script
// returns. It:
//   1. Sorts by fireAt (stable).
//   2. Pops the earliest non-cleared record and invokes its fn with
//      its args. Re-queues setInterval-style records.
//   3. Repeats until the queue is empty OR a callback throws (the
//      exception propagates to main.cpp's error reporter).
//
// process.nextTick is elsewhere (globals.cpp) and stays synchronous —
// matches Node where nextTick runs before any timer.
//
// This is still not a real libuv loop: there's no `sleep(ms)` between
// firings (we run everything back-to-back in fireAt order). Real
// wallclock delays would take a few lines of native sleep + they're
// rarely what scripts actually depend on; ordering is.

#include "node_compat/globals.h"

#include "jsapi.h"
#include "js/Conversions.h"

namespace ionpower {

// Implemented as JS in the bootstrap (see globals.cpp). The native
// stubs below are thin wrappers that forward to __timer_enqueue__
// and __timer_clear__ which the bootstrap defines.

static bool TimerEnqueue(JSContext* cx, unsigned argc, JS::Value* vp,
                         int delayArgIdx, bool isInterval)
{
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        args.rval().setInt32(0);
        return true;
    }
    JS::RootedObject global(cx, JS::CurrentGlobalOrNull(cx));
    if (!global) return false;
    JS::RootedValue fnV(cx);
    if (!JS_GetProperty(cx, global, "__timer_enqueue__", &fnV)) return false;
    if (!fnV.isObject()) {
        // Fall-back to sync invocation if bootstrap hasn't installed
        // the JS-level enqueue yet.
        JS::RootedValue fn(cx, args[0]);
        if (fn.isObject() && JS_ObjectIsFunction(cx, &fn.toObject())) {
            JS::RootedValue discard(cx);
            JS::AutoValueVector passArgs(cx);
            unsigned firstFwd = (delayArgIdx >= 0) ? (delayArgIdx + 1) : 1;
            unsigned forwarded = (args.length() > firstFwd)
                               ? (args.length() - firstFwd) : 0;
            if (!passArgs.resize(forwarded)) return false;
            for (unsigned i = 0; i < forwarded; ++i)
                passArgs[i].set(args[firstFwd + i]);
            JS::HandleValueArray ha(passArgs);
            if (!JS::Call(cx, JS::UndefinedHandleValue, fn, ha, &discard))
                return false;
        }
        args.rval().setInt32(0);
        return true;
    }

    // Shape to __timer_enqueue__(fn, delay, isInterval, ...userArgs).
    unsigned firstUser = (delayArgIdx >= 0) ? (delayArgIdx + 1) : 1;
    unsigned numUser = (args.length() > firstUser)
                     ? (args.length() - firstUser) : 0;
    unsigned total = 3 + numUser;
    JS::AutoValueVector forwardArgs(cx);
    if (!forwardArgs.resize(total))
        return false;
    forwardArgs[0].set(args[0]);                               // fn
    if (delayArgIdx >= 0 && args.length() > (unsigned)delayArgIdx) {
        forwardArgs[1].set(args[delayArgIdx]);                 // delay
    } else {
        forwardArgs[1].setInt32(0);
    }
    forwardArgs[2].setBoolean(isInterval);                     // isInterval
    for (unsigned i = 0; i < numUser; ++i)
        forwardArgs[3 + i].set(args[firstUser + i]);

    JS::RootedValue rv(cx);
    JS::HandleValueArray ha(forwardArgs);
    if (!JS::Call(cx, JS::UndefinedHandleValue, fnV, ha, &rv))
        return false;
    args.rval().set(rv);
    return true;
}

static bool TimerImmediate(JSContext* cx, unsigned argc, JS::Value* vp) {
    // setImmediate(fn, ...args) -> enqueue with delay 0.
    return TimerEnqueue(cx, argc, vp, /*delayArgIdx=*/-1, /*isInterval=*/false);
}

static bool TimerTimeout(JSContext* cx, unsigned argc, JS::Value* vp) {
    // setTimeout(fn, delay, ...args)
    return TimerEnqueue(cx, argc, vp, /*delayArgIdx=*/1, /*isInterval=*/false);
}

static bool TimerInterval(JSContext* cx, unsigned argc, JS::Value* vp) {
    // setInterval(fn, delay, ...args)
    return TimerEnqueue(cx, argc, vp, /*delayArgIdx=*/1, /*isInterval=*/true);
}

static bool TimerClear(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setUndefined();
    if (args.length() < 1) return true;
    JS::RootedObject global(cx, JS::CurrentGlobalOrNull(cx));
    if (!global) return true;
    JS::RootedValue fnV(cx);
    if (!JS_GetProperty(cx, global, "__timer_clear__", &fnV)) return true;
    if (!fnV.isObject()) return true;
    JS::RootedValue rv(cx);
    JS::AutoValueArray<1> fa(cx);
    fa[0].set(args[0]);
    (void)JS::Call(cx, JS::UndefinedHandleValue, fnV, fa, &rv);
    return true;
}

static const JSFunctionSpec kTimerFuncs[] = {
    JS_FN("setImmediate",   TimerImmediate, 1, 0),
    JS_FN("clearImmediate", TimerClear,     1, 0),
    JS_FN("setTimeout",     TimerTimeout,   2, 0),
    JS_FN("clearTimeout",   TimerClear,     1, 0),
    JS_FN("setInterval",    TimerInterval,  2, 0),
    JS_FN("clearInterval",  TimerClear,     1, 0),
    JS_FS_END
};

bool InstallTimers(JSContext* cx, JS::HandleObject global) {
    return JS_DefineFunctions(cx, global, kTimerFuncs);
}

} // namespace ionpower
