// console.{log,error,warn,info,debug}
//
// Format rule: each argument is rendered with a small util.inspect-lite:
// primitives print as themselves, objects/arrays use JSON.stringify with
// 2-space indent, functions print as "[Function: name]". Arguments are
// joined with a single space and terminated with '\n'.
//
// log/info/debug → stdout. warn/error → stderr (matches Node).

#include "node_compat/globals.h"

#include <stdio.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// Call JSON.stringify(value, null, 2) to render an object. Falls back to
// JS::ToString on failure (covers cycles, native types, etc.).
static JSString* RenderObject(JSContext* cx, JS::HandleValue v) {
    JS::RootedObject json(cx);
    {
        JS::RootedObject global(cx, JS::CurrentGlobalOrNull(cx));
        if (!global) return nullptr;
        JS::RootedValue jsonv(cx);
        if (!JS_GetProperty(cx, global, "JSON", &jsonv) || !jsonv.isObject())
            return JS::ToString(cx, v);
        json = &jsonv.toObject();
    }
    JS::RootedValue stringifyFn(cx);
    if (!JS_GetProperty(cx, json, "stringify", &stringifyFn) ||
        !stringifyFn.isObject()) {
        return JS::ToString(cx, v);
    }
    JS::AutoValueArray<3> args(cx);
    args[0].set(v);
    args[1].setNull();
    args[2].setInt32(2);
    JS::RootedValue out(cx);
    if (!JS::Call(cx, json, stringifyFn, args, &out) || !out.isString())
        return JS::ToString(cx, v);
    return out.toString();
}

static JSString* RenderValue(JSContext* cx, JS::HandleValue v) {
    // Objects that aren't null get JSON-rendered (arrays, plain objects).
    if (v.isObject()) {
        JS::RootedObject obj(cx, &v.toObject());
        if (JS_ObjectIsFunction(cx, obj)) {
            // Functions: "[Function: name]" or "[Function]".
            JS::RootedValue nameV(cx);
            if (JS_GetProperty(cx, obj, "name", &nameV) && nameV.isString()) {
                JS::RootedString nameStr(cx, nameV.toString());
                JSAutoByteString nb(cx, nameStr);
                if (nb.ptr() && nb.ptr()[0]) {
                    char buf[256];
                    snprintf(buf, sizeof buf, "[Function: %s]", nb.ptr());
                    return JS_NewStringCopyZ(cx, buf);
                }
            }
            return JS_NewStringCopyZ(cx, "[Function]");
        }
        return RenderObject(cx, v);
    }
    if (v.isUndefined()) return JS_NewStringCopyZ(cx, "undefined");
    if (v.isNull())      return JS_NewStringCopyZ(cx, "null");
    return JS::ToString(cx, v);
}

static bool WriteStringified(JSContext* cx, FILE* out,
                             const JS::CallArgs& args)
{
    for (unsigned i = 0; i < args.length(); ++i) {
        JS::RootedValue v(cx, args[i]);
        JS::RootedString s(cx, RenderValue(cx, v));
        if (!s)
            return false;
        JSAutoByteString bytes(cx, s);
        if (!bytes)
            return false;
        if (i > 0)
            fputc(' ', out);
        fputs(bytes.ptr(), out);
    }
    fputc('\n', out);
    fflush(out);
    args.rval().setUndefined();
    return true;
}

static bool ConsoleLog(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    return WriteStringified(cx, stdout, args);
}

static bool ConsoleErr(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    return WriteStringified(cx, stderr, args);
}

static const JSFunctionSpec kConsoleFuncs[] = {
    JS_FN("log",   ConsoleLog, 0, 0),
    JS_FN("info",  ConsoleLog, 0, 0),
    JS_FN("debug", ConsoleLog, 0, 0),
    JS_FN("warn",  ConsoleErr, 0, 0),
    JS_FN("error", ConsoleErr, 0, 0),
    JS_FS_END
};

bool InstallConsole(JSContext* cx, JS::HandleObject global)
{
    JS::RootedObject console(cx, JS_NewPlainObject(cx));
    if (!console)
        return false;
    if (!JS_DefineFunctions(cx, console, kConsoleFuncs))
        return false;
    return JS_DefineProperty(cx, global, "console", console, JSPROP_ENUMERATE);
}

} // namespace ionpower
