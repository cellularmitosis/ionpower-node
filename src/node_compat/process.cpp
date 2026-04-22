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
    if (!DefineStringProp(cx, process, "version",  "ionpower-node-0.1")) return false;

    JS::RootedValue pidv(cx, JS::Int32Value((int32_t)getpid()));
    if (!JS_DefineProperty(cx, process, "pid", pidv, JSPROP_ENUMERATE))
        return false;

    return JS_DefineProperty(cx, global, "process", process, JSPROP_ENUMERATE);
}

} // namespace ionpower
