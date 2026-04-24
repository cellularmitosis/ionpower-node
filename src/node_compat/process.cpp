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
#include <sys/stat.h>
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

static const JSFunctionSpec kProcessFuncs[] = {
    JS_FN("cwd",    ProcessCwd,    0, 0),
    JS_FN("exit",   ProcessExit,   1, 0),
    JS_FN("getenv", ProcessGetenv, 1, 0),
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
    if (!DefineStringProp(cx, process, "version",  "ionpower-node-0.17")) return false;

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
        // Columns / rows: unknown-but-non-zero when TTY, otherwise undefined.
        // (We don't yet call TIOCGWINSZ.)
        if (isatty(fd)) {
            JS::RootedValue c(cx, JS::Int32Value(80));
            JS::RootedValue r(cx, JS::Int32Value(24));
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
