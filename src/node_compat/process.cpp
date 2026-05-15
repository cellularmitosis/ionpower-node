// process.{argv,env,platform,arch,version,cwd,exit,pid}
//
// process.argv follows Node convention: argv[0] is the runtime binary,
// argv[1] is the entry script, argv[2..] are user args. We feed this
// straight from main()'s argc/argv.

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <termios.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/resource.h>
extern char** environ;

// Forward-declare the native write handler; installed per-stream below.
static bool ProcessStreamWrite(JSContext* cx, unsigned argc, JS::Value* vp);

#include "jsapi.h"
#include "js/Conversions.h"

namespace ionpower {

static bool ProcessCwd(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    char buf[4096];
    if (!getcwd(buf, sizeof buf)) {
        JS_ReportError(cx, "process.cwd: %s", strerror(errno));
        return false;
    }
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, buf));
    if (!s)
        return false;
    args.rval().setString(s);
    return true;
}

// POSIX uid/gid accessors. tar's preserveOwner gate, pacote's
// selfOwner, npm-lifecycle install scripts all branch on whether
// these are present and what they return — Node ships them only on
// non-Windows builds, which is exactly our target. Thin wrappers
// over getuid(2) etc.; on Tiger these never fail (return current
// process credentials).
static bool ProcessGetuid(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setInt32((int32_t)getuid());
    return true;
}
static bool ProcessGetgid(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setInt32((int32_t)getgid());
    return true;
}
static bool ProcessGeteuid(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setInt32((int32_t)geteuid());
    return true;
}
static bool ProcessGetegid(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setInt32((int32_t)getegid());
    return true;
}

static bool ProcessExit(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int32_t code = 0;
    if (args.length() >= 1) {
        if (!JS::ToInt32(cx, args[0], &code))
            return false;
    }
    fflush(stdout);
    fflush(stderr);
    exit(code);
    // not reached
}

// process.cpuUsage([previous]) — Node returns user + system in
// microseconds; if `previous` is passed, returns the delta.
static bool ProcessCpuUsage(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    struct rusage ru;
    if (getrusage(RUSAGE_SELF, &ru) != 0) {
        JS_ReportError(cx, "process.cpuUsage: %s", strerror(errno));
        return false;
    }
    int64_t user = (int64_t)ru.ru_utime.tv_sec * 1000000 + (int64_t)ru.ru_utime.tv_usec;
    int64_t sys  = (int64_t)ru.ru_stime.tv_sec * 1000000 + (int64_t)ru.ru_stime.tv_usec;

    // Optional previous arg: subtract its .user / .system fields.
    if (args.length() >= 1 && args[0].isObject()) {
        JS::RootedObject prev(cx, &args[0].toObject());
        JS::RootedValue uv(cx), sv(cx);
        if (JS_GetProperty(cx, prev, "user", &uv) && uv.isNumber())
            user -= (int64_t)uv.toNumber();
        if (JS_GetProperty(cx, prev, "system", &sv) && sv.isNumber())
            sys -= (int64_t)sv.toNumber();
    }

    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out) return false;
    JS::RootedValue uV(cx, JS::NumberValue((double)user));
    JS::RootedValue sV(cx, JS::NumberValue((double)sys));
    if (!JS_DefineProperty(cx, out, "user",   uV, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, out, "system", sV, JSPROP_ENUMERATE)) return false;
    args.rval().setObject(*out);
    return true;
}

// process.resourceUsage() — Node-style stats from getrusage.
static bool ProcessResourceUsage(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    struct rusage ru;
    if (getrusage(RUSAGE_SELF, &ru) != 0) {
        JS_ReportError(cx, "process.resourceUsage: %s", strerror(errno));
        return false;
    }
    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out) return false;

    auto setNum = [&](const char* key, double v) {
        JS::RootedValue val(cx, JS::NumberValue(v));
        return JS_DefineProperty(cx, out, key, val, JSPROP_ENUMERATE);
    };

    double user = (double)ru.ru_utime.tv_sec * 1e6 + (double)ru.ru_utime.tv_usec;
    double sys  = (double)ru.ru_stime.tv_sec * 1e6 + (double)ru.ru_stime.tv_usec;
    if (!setNum("userCPUTime",   user)) return false;
    if (!setNum("systemCPUTime", sys))  return false;
    // ru_maxrss on Darwin is in bytes; Node reports it in KB.
    if (!setNum("maxRSS",                 (double)ru.ru_maxrss / 1024.0)) return false;
    if (!setNum("sharedMemorySize",       (double)ru.ru_ixrss)) return false;
    if (!setNum("unsharedDataSize",       (double)ru.ru_idrss)) return false;
    if (!setNum("unsharedStackSize",      (double)ru.ru_isrss)) return false;
    if (!setNum("minorPageFault",         (double)ru.ru_minflt)) return false;
    if (!setNum("majorPageFault",         (double)ru.ru_majflt)) return false;
    if (!setNum("swappedOut",             (double)ru.ru_nswap)) return false;
    if (!setNum("fsRead",                 (double)ru.ru_inblock)) return false;
    if (!setNum("fsWrite",                (double)ru.ru_oublock)) return false;
    if (!setNum("ipcSent",                (double)ru.ru_msgsnd)) return false;
    if (!setNum("ipcReceived",            (double)ru.ru_msgrcv)) return false;
    if (!setNum("signalsCount",           (double)ru.ru_nsignals)) return false;
    if (!setNum("voluntaryContextSwitches",   (double)ru.ru_nvcsw)) return false;
    if (!setNum("involuntaryContextSwitches", (double)ru.ru_nivcsw)) return false;

    args.rval().setObject(*out);
    return true;
}

static bool ProcessGetenv(JSContext* cx, unsigned argc, JS::Value* vp) {
    // Not standard Node API, but convenient mirror of os.getenv.
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        args.rval().setUndefined();
        return true;
    }
    JS::RootedString name(cx, JS::ToString(cx, args[0]));
    if (!name) return false;
    JSAutoByteString bytes(cx, name);
    if (!bytes) return false;
    const char* v = getenv(bytes.ptr());
    if (!v) {
        args.rval().setUndefined();
        return true;
    }
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, v));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

// process._setRawMode(fd, raw): tcsetattr-based raw-mode toggle for
// process.stdin (or any TTY fd). Caches the original termios on
// first raw-mode call so a setRawMode(false) afterwards restores
// exactly what the user had before. Returns the previous raw state.
static struct termios kSavedTermios[3];
static bool           kSavedTermiosValid[3] = { false, false, false };
static bool           kCurrentlyRaw[3]      = { false, false, false };

static bool ProcessSetRawMode(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2 || !args[0].isInt32()) {
        JS_ReportError(cx, "process._setRawMode: (fd, bool) required");
        return false;
    }
    int fd = args[0].toInt32();
    bool wantRaw = JS::ToBoolean(args[1]);
    if (fd < 0 || fd > 2) {
        JS_ReportError(cx, "process._setRawMode: fd must be 0/1/2");
        return false;
    }
    if (!isatty(fd)) {
        // Not a TTY — silently no-op (matches Node when stdin is a pipe).
        args.rval().setBoolean(false);
        return true;
    }
    bool prev = kCurrentlyRaw[fd];
    if (wantRaw) {
        // Save original on first raw call.
        if (!kSavedTermiosValid[fd]) {
            if (tcgetattr(fd, &kSavedTermios[fd]) != 0) {
                JS_ReportError(cx, "process._setRawMode: tcgetattr: %s", strerror(errno));
                return false;
            }
            kSavedTermiosValid[fd] = true;
        }
        struct termios raw = kSavedTermios[fd];
        // Mirror Node's setRawMode — disable canonical mode + echo +
        // signal char generation; turn off CR/NL translation; keep
        // 8-bit clean.
        raw.c_iflag &= ~(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL | IXON);
        raw.c_oflag &= ~OPOST;
        raw.c_lflag &= ~(ECHO | ECHONL | ICANON | ISIG | IEXTEN);
        raw.c_cflag &= ~(CSIZE | PARENB);
        raw.c_cflag |= CS8;
        raw.c_cc[VMIN]  = 1;
        raw.c_cc[VTIME] = 0;
        if (tcsetattr(fd, TCSANOW, &raw) != 0) {
            JS_ReportError(cx, "process._setRawMode: tcsetattr raw: %s", strerror(errno));
            return false;
        }
        kCurrentlyRaw[fd] = true;
    } else {
        if (kSavedTermiosValid[fd]) {
            if (tcsetattr(fd, TCSANOW, &kSavedTermios[fd]) != 0) {
                JS_ReportError(cx, "process._setRawMode: tcsetattr restore: %s", strerror(errno));
                return false;
            }
        }
        kCurrentlyRaw[fd] = false;
    }
    args.rval().setBoolean(prev);
    return true;
}

// process._tty_size(fd): returns { columns, rows } using TIOCGWINSZ,
// or null if the fd isn't a TTY or the ioctl fails.
static bool ProcessTtySize(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    int fd = (args.length() >= 1 && args[0].isInt32()) ? args[0].toInt32() : 1;
    if (!isatty(fd)) { args.rval().setNull(); return true; }
    struct winsize ws;
    if (ioctl(fd, TIOCGWINSZ, &ws) != 0) {
        args.rval().setNull(); return true;
    }
    JS::RootedObject o(cx, JS_NewPlainObject(cx));
    JS::RootedValue cv(cx, JS::Int32Value(ws.ws_col ? ws.ws_col : 80));
    JS::RootedValue rv(cx, JS::Int32Value(ws.ws_row ? ws.ws_row : 24));
    if (!JS_DefineProperty(cx, o, "columns", cv, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, o, "rows",    rv, JSPROP_ENUMERATE)) return false;
    args.rval().setObject(*o);
    return true;
}

static const JSFunctionSpec kProcessFuncs[] = {
    JS_FN("cwd",            ProcessCwd,           0, 0),
    JS_FN("exit",           ProcessExit,          1, 0),
    JS_FN("getenv",         ProcessGetenv,        1, 0),
    JS_FN("getuid",         ProcessGetuid,        0, 0),
    JS_FN("getgid",         ProcessGetgid,        0, 0),
    JS_FN("geteuid",        ProcessGeteuid,       0, 0),
    JS_FN("getegid",        ProcessGetegid,       0, 0),
    JS_FN("_setRawMode",    ProcessSetRawMode,    2, 0),
    JS_FN("_tty_size",      ProcessTtySize,       1, 0),
    JS_FN("cpuUsage",       ProcessCpuUsage,      1, 0),
    JS_FN("resourceUsage",  ProcessResourceUsage, 0, 0),
    JS_FS_END
};

static bool DefineArgv(JSContext* cx, JS::HandleObject process,
                       int argc, char** argv)
{
    JS::RootedObject arr(cx, JS_NewArrayObject(cx, argc));
    if (!arr) return false;
    for (int i = 0; i < argc; ++i) {
        JS::RootedString s(cx, JS_NewStringCopyZ(cx, argv[i]));
        if (!s) return false;
        JS::RootedValue v(cx, JS::StringValue(s));
        if (!JS_SetElement(cx, arr, i, v)) return false;
    }
    return JS_DefineProperty(cx, process, "argv", arr, JSPROP_ENUMERATE);
}

static bool DefineEnv(JSContext* cx, JS::HandleObject process)
{
    JS::RootedObject env(cx, JS_NewPlainObject(cx));
    if (!env) return false;
    for (char** e = environ; e && *e; ++e) {
        const char* eq = strchr(*e, '=');
        if (!eq) continue;
        size_t n = eq - *e;
        JS::RootedString key(cx, JS_NewStringCopyN(cx, *e, n));
        if (!key) return false;
        JS::RootedString val(cx, JS_NewStringCopyZ(cx, eq + 1));
        if (!val) return false;
        JS::RootedValue kval(cx, JS::StringValue(val));
        JS::RootedId id(cx);
        if (!JS_StringToId(cx, key, &id)) return false;
        if (!JS_DefinePropertyById(cx, env, id, kval, JSPROP_ENUMERATE))
            return false;
    }
    return JS_DefineProperty(cx, process, "env", env, JSPROP_ENUMERATE);
}

static bool DefineStringProp(JSContext* cx, JS::HandleObject obj,
                             const char* name, const char* value)
{
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, value));
    if (!s) return false;
    JS::RootedValue v(cx, JS::StringValue(s));
    return JS_DefineProperty(cx, obj, name, v, JSPROP_ENUMERATE);
}

bool InstallProcess(JSContext* cx, JS::HandleObject global,
                    int argc, char** argv)
{
    JS::RootedObject process(cx, JS_NewPlainObject(cx));
    if (!process)
        return false;
    if (!JS_DefineFunctions(cx, process, kProcessFuncs)) return false;
    if (!DefineArgv(cx, process, argc, argv)) return false;
    if (!DefineEnv(cx, process)) return false;
    if (!DefineStringProp(cx, process, "platform", "darwin"))     return false;
    if (!DefineStringProp(cx, process, "arch",     "ppc"))        return false;
    // process.version: as of pass-1 of Node 10 parity (see
    // docs/plans/node-target-version.md), report a real Node version
    // string so libraries that feed this into a semver parser don't
    // throw. The runtime's own identity moves to
    // process.versions['ionpower-node'] below.
    if (!DefineStringProp(cx, process, "version",  "v10.24.1")) return false;

    // process.versions: { node, 'ionpower-node' } seeded here; the JS
    // bootstrap (globals.cpp kBootstrapJS) augments with spidermonkey,
    // openssl, v8 once those subsystems are up.
    {
        JS::RootedObject versions(cx, JS_NewPlainObject(cx));
        if (!versions) return false;
        if (!DefineStringProp(cx, versions, "node",          "10.24.1")) return false;
        // 'ionpower-node' uses bracket access on the JS side because of the dash.
        if (!DefineStringProp(cx, versions, "ionpower-node", "0.97"))    return false;
        if (!JS_DefineProperty(cx, process, "versions", versions, JSPROP_ENUMERATE))
            return false;
    }

    // process.execPath: absolute path to the runtime binary. Mirrors
    // process.argv[0]. Real Node has this; libraries like which / isexe
    // use it for self-detection.
    if (argc >= 1 && argv && argv[0]) {
        if (!DefineStringProp(cx, process, "execPath", argv[0])) return false;
    } else {
        if (!DefineStringProp(cx, process, "execPath", "")) return false;
    }

    // process.binding(name): legacy private API that older libs
    // (fs-minipass, npm internals) reach into for native C++ bindings.
    // We deliberately do NOT expose internals — return an empty object
    // so module load succeeds. If anything actually CALLS a binding
    // method later it fails at use-time, which is the right behavior.
    {
        static const char kBindingSrc[] =
            "(function () { return function (name) { return {}; }; })()";
        JS::CompileOptions opts(cx);
        opts.setFileAndLine("<process.binding stub>", 1);
        JS::RootedValue bindingFn(cx);
        if (!JS::Evaluate(cx, opts, kBindingSrc, sizeof(kBindingSrc) - 1, &bindingFn))
            return false;
        if (!JS_DefineProperty(cx, process, "binding", bindingFn, JSPROP_ENUMERATE))
            return false;
    }

    JS::RootedValue pidv(cx, JS::Int32Value((int32_t)getpid()));
    if (!JS_DefineProperty(cx, process, "pid", pidv, JSPROP_ENUMERATE))
        return false;

    // process.stdout / process.stderr — minimal shim. Real Node exposes a
    // Writable stream; we expose just enough for TTY detection (which is
    // what most libraries check) plus a synchronous `.write()` that
    // delegates to fputs. `.fd` is 1 / 2 for completeness.
    auto makeStream = [&](int fd) -> JSObject* {
        JS::RootedObject s(cx, JS_NewPlainObject(cx));
        if (!s) return nullptr;
        JS::RootedValue fdV(cx, JS::Int32Value(fd));
        if (!JS_DefineProperty(cx, s, "fd", fdV, JSPROP_ENUMERATE)) return nullptr;
        JS::RootedValue isttyV(cx, JS::BooleanValue(isatty(fd) != 0));
        if (!JS_DefineProperty(cx, s, "isTTY", isttyV, JSPROP_ENUMERATE)) return nullptr;
        // Columns / rows: query the real terminal via TIOCGWINSZ when
        // the fd is a TTY. Falls back to 80x24 if the ioctl reports
        // zero (some pseudo-TTYs do that before the controlling
        // process sets a size).
        if (isatty(fd)) {
            int cols = 80, rows = 24;
            struct winsize ws;
            if (ioctl(fd, TIOCGWINSZ, &ws) == 0) {
                if (ws.ws_col) cols = ws.ws_col;
                if (ws.ws_row) rows = ws.ws_row;
            }
            JS::RootedValue c(cx, JS::Int32Value(cols));
            JS::RootedValue r(cx, JS::Int32Value(rows));
            if (!JS_DefineProperty(cx, s, "columns", c, JSPROP_ENUMERATE)) return nullptr;
            if (!JS_DefineProperty(cx, s, "rows",    r, JSPROP_ENUMERATE)) return nullptr;
        }
        // .write(data) — accepts a string or a Uint8Array. Returns true
        // (Node says: whether the kernel buffer has room for more;
        // we're synchronous and always drained, so always true).
        if (!JS_DefineFunction(cx, s, "write", ProcessStreamWrite, 1, JSPROP_ENUMERATE))
            return nullptr;
        return s;
    };

    JS::RootedObject stdoutObj(cx, makeStream(1));
    JS::RootedObject stderrObj(cx, makeStream(2));
    if (!stdoutObj || !stderrObj) return false;
    if (!JS_DefineProperty(cx, process, "stdout", stdoutObj, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, process, "stderr", stderrObj, JSPROP_ENUMERATE)) return false;

    // process.stdin — readable surface. Libraries that check .isTTY (ora,
    // inquirer, etc.) need a real shape; libraries that want to read
    // piped input use fs.readFileSync('/dev/stdin'). .on('data') is
    // wired up in JS-land (globals.cpp) so first-listener synchronously
    // drains and emits, then emits 'end'.
    JS::RootedObject stdinObj(cx, JS_NewPlainObject(cx));
    if (!stdinObj) return false;
    JS::RootedValue fd0(cx, JS::Int32Value(0));
    if (!JS_DefineProperty(cx, stdinObj, "fd", fd0, JSPROP_ENUMERATE)) return false;
    JS::RootedValue isttyIn(cx, JS::BooleanValue(isatty(0) != 0));
    if (!JS_DefineProperty(cx, stdinObj, "isTTY", isttyIn, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, process, "stdin", stdinObj, JSPROP_ENUMERATE)) return false;

    return JS_DefineProperty(cx, global, "process", process, JSPROP_ENUMERATE);
}

} // namespace ionpower

// Out-of-class so the declaration earlier can refer to it.
#include "jsfriendapi.h"
static bool ProcessStreamWrite(JSContext* cx, unsigned argc, JS::Value* vp)
{
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { args.rval().setBoolean(true); return true; }

    // Figure out which fd this is. `this` is the stream object; read .fd.
    int fd = 1;
    if (args.thisv().isObject()) {
        JS::RootedObject self(cx, &args.thisv().toObject());
        JS::RootedValue fdV(cx);
        if (JS_GetProperty(cx, self, "fd", &fdV) && fdV.isInt32())
            fd = fdV.toInt32();
    }

    if (args[0].isString()) {
        JS::RootedString s(cx, args[0].toString());
        JSAutoByteString bytes;
        if (!bytes.encodeUtf8(cx, s)) return false;
        const char* p = bytes.ptr();
        size_t n = strlen(p);
        // Write in a loop so large strings go through cleanly.
        while (n > 0) {
            ssize_t w = write(fd, p, n);
            if (w < 0) {
                if (errno == EINTR) continue;
                JS_ReportError(cx, "process.stdout.write: %s", strerror(errno));
                return false;
            }
            p += w; n -= (size_t)w;
        }
    } else if (args[0].isObject() && JS_IsUint8Array(&args[0].toObject())) {
        JS::RootedObject u8(cx, &args[0].toObject());
        uint32_t len = JS_GetTypedArrayByteLength(u8);
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        uint8_t* data = JS_GetUint8ArrayData(u8, &sharedDummy, nogc);
        while (len > 0 && data) {
            ssize_t w = write(fd, data, len);
            if (w < 0) {
                if (errno == EINTR) continue;
                JS_ReportError(cx, "process.stdout.write: %s", strerror(errno));
                return false;
            }
            data += w; len -= (uint32_t)w;
        }
    } else {
        // Coerce to string as a last resort.
        JS::RootedString s(cx, JS::ToString(cx, args[0]));
        if (!s) return false;
        JSAutoByteString bytes;
        if (!bytes.encodeUtf8(cx, s)) return false;
        size_t n = strlen(bytes.ptr());
        const char* p = bytes.ptr();
        while (n > 0) {
            ssize_t w = write(fd, p, n);
            if (w < 0) { if (errno == EINTR) continue; JS_ReportError(cx, "write: %s", strerror(errno)); return false; }
            p += w; n -= (size_t)w;
        }
    }
    args.rval().setBoolean(true);
    return true;
}
