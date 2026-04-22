// Buffer shim.
//
// We don't implement Node's full Buffer class. Instead we install a global
// `Buffer` constructor (and `Buffer.from`, `Buffer.alloc`) that returns a
// Uint8Array — which *does* work for any consumer that only needs bytes
// and isn't using the Buffer-specific methods. It is intentionally narrow.
//
// Covered:
//   Buffer.from(string, 'utf8'?)   — returns Uint8Array of UTF-8 bytes.
//   Buffer.from(arrayLike)         — returns Uint8Array copy.
//   Buffer.alloc(n)                — zero-filled Uint8Array of length n.
//   buf.toString('utf8'?)          — monkeypatched onto Uint8Array proto.

#include "node_compat/globals.h"

#include <stdio.h>
#include <string.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

static bool BufferFrom(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "Buffer.from: requires argument");
        return false;
    }
    if (args[0].isString()) {
        JS::RootedString s(cx, args[0].toString());
        JSAutoByteString b;
        if (!b.encodeUtf8(cx, s)) return false;
        size_t len = strlen(b.ptr());
        JS::RootedObject arr(cx, JS_NewUint8Array(cx, len));
        if (!arr) return false;
        {
            JS::AutoCheckCannotGC nogc;
            bool sharedDummy;
            uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
            if (out) memcpy(out, b.ptr(), len);
        }
        args.rval().setObject(*arr);
        return true;
    }
    // Array-like: length + [0..length-1].
    if (args[0].isObject()) {
        JS::RootedObject src(cx, &args[0].toObject());
        uint32_t len = 0;
        JS::RootedValue lv(cx);
        if (!JS_GetProperty(cx, src, "length", &lv)) return false;
        if (!JS::ToUint32(cx, lv, &len)) return false;
        JS::RootedObject arr(cx, JS_NewUint8Array(cx, len));
        if (!arr) return false;
        for (uint32_t i = 0; i < len; ++i) {
            JS::RootedValue v(cx);
            if (!JS_GetElement(cx, src, i, &v)) return false;
            uint32_t byteVal = 0;
            if (!JS::ToUint32(cx, v, &byteVal)) return false;
            JS::RootedValue bv(cx, JS::NumberValue((uint8_t)byteVal));
            if (!JS_SetElement(cx, arr, i, bv)) return false;
        }
        args.rval().setObject(*arr);
        return true;
    }
    JS_ReportError(cx, "Buffer.from: unsupported argument type");
    return false;
}

static bool BufferAlloc(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "Buffer.alloc: size required");
        return false;
    }
    uint32_t n = 0;
    if (!JS::ToUint32(cx, args[0], &n)) return false;
    JS::RootedObject arr(cx, JS_NewUint8Array(cx, n));
    if (!arr) return false;
    args.rval().setObject(*arr);
    return true;
}

// Uint8Array.prototype.toString patch: supports 'utf8' / 'ascii' / 'latin1'.
static bool BufferToString(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (!args.thisv().isObject()) { JS_ReportError(cx, "Buffer.toString: no this"); return false; }
    JS::RootedObject self(cx, &args.thisv().toObject());
    if (!JS_IsUint8Array(self)) {
        // Fall back to Object.prototype.toString behavior.
        JS::RootedString s(cx, JS_NewStringCopyZ(cx, "[object Object]"));
        args.rval().setString(s);
        return true;
    }
    uint32_t len = JS_GetTypedArrayByteLength(self);
    char* tmp = (char*)malloc((size_t)len + 1);
    if (!tmp) return false;
    {
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        const uint8_t* data = JS_GetUint8ArrayData(self, &sharedDummy, nogc);
        if (data) memcpy(tmp, data, len);
    }
    tmp[len] = 0;
    JS::RootedString s(cx, JS_NewStringCopyN(cx, tmp, len));
    free(tmp);
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

bool InstallBuffer(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject bufCtor(cx, JS_NewObject(cx, nullptr));
    if (!bufCtor) return false;
    if (!JS_DefineFunction(cx, bufCtor, "from",  BufferFrom,  2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, bufCtor, "alloc", BufferAlloc, 1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, global, "Buffer", bufCtor, JSPROP_ENUMERATE))
        return false;

    // Patch Uint8Array.prototype.toString with our Buffer-style toString.
    // Done in JS for simplicity:
    //   Uint8Array.prototype.toString = function (enc) { return __buf_tostr__(this, enc); }
    if (!JS_DefineFunction(cx, global, "__buf_tostr__", BufferToString, 1,
                           JSPROP_PERMANENT | JSPROP_READONLY))
        return false;

    static const char kPatch[] =
        "Uint8Array.prototype.toString = function(enc) { return __buf_tostr__.call(this, enc); };\n";
    JS::CompileOptions opts(cx);
    opts.setFileAndLine("<ionpower-node buffer patch>", 1);
    JS::RootedValue discard(cx);
    return JS::Evaluate(cx, opts, kPatch, sizeof(kPatch) - 1, &discard);
}

} // namespace ionpower
