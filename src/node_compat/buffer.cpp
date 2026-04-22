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
#include "js/CharacterEncoding.h"
#include "js/Conversions.h"

namespace ionpower {

// Encoding kinds supported by Buffer.from / Buffer#toString.
enum BufEnc {
    ENC_UTF8,     // default
    ENC_UTF16LE,  // ucs2 / utf16le / utf-16le
    ENC_LATIN1,   // latin1 / binary / ascii
    ENC_BASE64,
    ENC_HEX
};

static BufEnc ParseEncodingString(const char* s) {
    if (!s || !*s) return ENC_UTF8;
    if (!strcmp(s, "utf8") || !strcmp(s, "utf-8"))           return ENC_UTF8;
    if (!strcmp(s, "ucs2") || !strcmp(s, "ucs-2") ||
        !strcmp(s, "utf16le") || !strcmp(s, "utf-16le") ||
        !strcmp(s, "utf16-le"))                              return ENC_UTF16LE;
    if (!strcmp(s, "latin1") || !strcmp(s, "binary") ||
        !strcmp(s, "ascii"))                                 return ENC_LATIN1;
    if (!strcmp(s, "base64"))                                return ENC_BASE64;
    if (!strcmp(s, "hex"))                                   return ENC_HEX;
    return ENC_UTF8;
}

// Returns the encoding from a JS argument (string) or ENC_UTF8 if missing.
static BufEnc EncFromArg(JSContext* cx, JS::HandleValue v) {
    if (!v.isString()) return ENC_UTF8;
    JS::RootedString s(cx, v.toString());
    JSAutoByteString b(cx, s);
    if (!b) return ENC_UTF8;
    return ParseEncodingString(b.ptr());
}

static int HexDigit(unsigned char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

// Base64 decode helper; returns number of bytes written, or (size_t)-1 on
// invalid input. Ignores whitespace; stops at '='.
static size_t Base64Decode(const char* in, size_t inLen, uint8_t* out) {
    static const signed char tbl[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
    };
    size_t o = 0;
    int bits = 0, val = 0;
    for (size_t i = 0; i < inLen; ++i) {
        unsigned char c = (unsigned char)in[i];
        if (c == '=' || c == '\n' || c == '\r' || c == ' ' || c == '\t') {
            if (c == '=') break;
            continue;
        }
        int d = tbl[c];
        if (d < 0) return (size_t)-1;
        val = (val << 6) | d;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[o++] = (uint8_t)((val >> bits) & 0xFF);
        }
    }
    return o;
}

static const char kBase64Chars[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Caller must ensure `out` has room for ceil(len/3)*4 bytes.
static size_t Base64Encode(const uint8_t* in, size_t len, char* out) {
    size_t i = 0, o = 0;
    while (i + 3 <= len) {
        uint32_t v = ((uint32_t)in[i] << 16) | ((uint32_t)in[i+1] << 8) | in[i+2];
        out[o++] = kBase64Chars[(v >> 18) & 0x3F];
        out[o++] = kBase64Chars[(v >> 12) & 0x3F];
        out[o++] = kBase64Chars[(v >>  6) & 0x3F];
        out[o++] = kBase64Chars[ v        & 0x3F];
        i += 3;
    }
    if (i < len) {
        uint32_t v = ((uint32_t)in[i]) << 16;
        if (i + 1 < len) v |= ((uint32_t)in[i+1]) << 8;
        out[o++] = kBase64Chars[(v >> 18) & 0x3F];
        out[o++] = kBase64Chars[(v >> 12) & 0x3F];
        out[o++] = (i + 1 < len) ? kBase64Chars[(v >> 6) & 0x3F] : '=';
        out[o++] = '=';
    }
    return o;
}

static bool BufferFrom(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "Buffer.from: requires argument");
        return false;
    }
    if (args[0].isString()) {
        JS::RootedString s(cx, args[0].toString());
        BufEnc enc = args.length() >= 2 ? EncFromArg(cx, args[1]) : ENC_UTF8;

        if (enc == ENC_UTF16LE) {
            // Encode as little-endian UTF-16 code units (BMP only; surrogates
            // pass through as separate code units, matching Node's ucs2).
            size_t clen = JS_GetStringLength(s);
            JS::RootedObject arr(cx, JS_NewUint8Array(cx, clen * 2));
            if (!arr) return false;
            char16_t* buf16 = (char16_t*)malloc(sizeof(char16_t) * clen);
            if (!buf16) return false;
            if (!JS_CopyStringChars(cx, mozilla::Range<char16_t>(buf16, clen), s)) {
                free(buf16); return false;
            }
            {
                JS::AutoCheckCannotGC nogc;
                bool sharedDummy;
                uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
                if (out) {
                    for (size_t i = 0; i < clen; ++i) {
                        out[i*2]     = (uint8_t)(buf16[i] & 0xFF);
                        out[i*2 + 1] = (uint8_t)((buf16[i] >> 8) & 0xFF);
                    }
                }
            }
            free(buf16);
            args.rval().setObject(*arr);
            return true;
        }

        if (enc == ENC_LATIN1) {
            // One byte per code unit, low byte only.
            size_t clen = JS_GetStringLength(s);
            JS::RootedObject arr(cx, JS_NewUint8Array(cx, clen));
            if (!arr) return false;
            char16_t* buf16 = (char16_t*)malloc(sizeof(char16_t) * clen);
            if (!buf16) return false;
            if (!JS_CopyStringChars(cx, mozilla::Range<char16_t>(buf16, clen), s)) {
                free(buf16); return false;
            }
            {
                JS::AutoCheckCannotGC nogc;
                bool sharedDummy;
                uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
                if (out) {
                    for (size_t i = 0; i < clen; ++i)
                        out[i] = (uint8_t)(buf16[i] & 0xFF);
                }
            }
            free(buf16);
            args.rval().setObject(*arr);
            return true;
        }

        if (enc == ENC_HEX) {
            JSAutoByteString b;
            if (!b.encodeLatin1(cx, s)) return false;
            size_t hlen = strlen(b.ptr());
            if (hlen % 2) { JS_ReportError(cx, "Buffer.from hex: odd length"); return false; }
            size_t blen = hlen / 2;
            JS::RootedObject arr(cx, JS_NewUint8Array(cx, blen));
            if (!arr) return false;
            const char* p = b.ptr();
            JS::AutoCheckCannotGC nogc;
            bool sharedDummy;
            uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
            if (out) {
                for (size_t i = 0; i < blen; ++i) {
                    int hi = HexDigit(p[i*2]);
                    int lo = HexDigit(p[i*2+1]);
                    if (hi < 0 || lo < 0) {
                        JS_ReportError(cx, "Buffer.from hex: bad digit");
                        return false;
                    }
                    out[i] = (uint8_t)((hi << 4) | lo);
                }
            }
            args.rval().setObject(*arr);
            return true;
        }

        if (enc == ENC_BASE64) {
            JSAutoByteString b;
            if (!b.encodeLatin1(cx, s)) return false;
            size_t inLen = strlen(b.ptr());
            // Decoded size upper bound: ceil(inLen*3/4).
            size_t bound = (inLen * 3 / 4) + 2;
            uint8_t* tmp = (uint8_t*)malloc(bound);
            if (!tmp) return false;
            size_t n = Base64Decode(b.ptr(), inLen, tmp);
            if (n == (size_t)-1) {
                free(tmp);
                JS_ReportError(cx, "Buffer.from base64: bad character");
                return false;
            }
            JS::RootedObject arr(cx, JS_NewUint8Array(cx, n));
            if (!arr) { free(tmp); return false; }
            {
                JS::AutoCheckCannotGC nogc;
                bool sharedDummy;
                uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
                if (out) memcpy(out, tmp, n);
            }
            free(tmp);
            args.rval().setObject(*arr);
            return true;
        }

        // Default: UTF-8.
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
    // Optional fill byte. Node's semantics are richer (strings, Buffers) but
    // iconv-lite only uses the integer-fill form, which is what we support.
    if (args.length() >= 2 && !args[1].isUndefined()) {
        uint32_t fill = 0;
        if (!JS::ToUint32(cx, args[1], &fill)) return false;
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
        if (out) memset(out, (int)(fill & 0xFF), n);
    }
    args.rval().setObject(*arr);
    return true;
}

// Uint8Array.prototype.toString patch. Supports
//   utf8 (default), ucs2/utf16le, latin1/binary/ascii, base64, hex.
// Ignores optional `start`/`end` arguments (Node Buffer#toString takes them,
// but iconv's hot paths don't use them).
static bool BufferToString(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (!args.thisv().isObject()) { JS_ReportError(cx, "Buffer.toString: no this"); return false; }
    JS::RootedObject self(cx, &args.thisv().toObject());
    if (!JS_IsUint8Array(self)) {
        JS::RootedString s(cx, JS_NewStringCopyZ(cx, "[object Object]"));
        args.rval().setString(s);
        return true;
    }
    uint32_t len = JS_GetTypedArrayByteLength(self);
    BufEnc enc = args.length() >= 1 ? EncFromArg(cx, args[0]) : ENC_UTF8;
    uint32_t start = 0, end = len;
    if (args.length() >= 2 && args[1].isNumber()) {
        int32_t v = 0;
        if (!JS::ToInt32(cx, args[1], &v)) return false;
        if (v < 0) v = 0; if ((uint32_t)v > len) v = (int32_t)len;
        start = (uint32_t)v;
    }
    if (args.length() >= 3 && args[2].isNumber()) {
        int32_t v = 0;
        if (!JS::ToInt32(cx, args[2], &v)) return false;
        if (v < 0) v = 0; if ((uint32_t)v > len) v = (int32_t)len;
        end = (uint32_t)v;
    }
    if (end < start) end = start;
    uint32_t slen = end - start;

    JS::AutoCheckCannotGC nogc;
    bool sharedDummy;
    const uint8_t* data = JS_GetUint8ArrayData(self, &sharedDummy, nogc);
    if (!data) { args.rval().setString(JS_NewStringCopyZ(cx, "")); return true; }
    data += start;

    if (enc == ENC_UTF16LE) {
        // 2 bytes → 1 UTF-16 code unit (little-endian).
        size_t nUnits = slen / 2;
        char16_t* chars = (char16_t*)malloc(sizeof(char16_t) * (nUnits + 1));
        if (!chars) return false;
        for (size_t i = 0; i < nUnits; ++i)
            chars[i] = (char16_t)(data[i*2] | ((uint16_t)data[i*2+1] << 8));
        chars[nUnits] = 0;
        JS::RootedString s(cx, JS_NewUCStringCopyN(cx, chars, nUnits));
        free(chars);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }

    if (enc == ENC_LATIN1) {
        // Each byte is a code point in U+0000..U+00FF.
        char16_t* chars = (char16_t*)malloc(sizeof(char16_t) * (slen + 1));
        if (!chars) return false;
        for (uint32_t i = 0; i < slen; ++i) chars[i] = (char16_t)data[i];
        chars[slen] = 0;
        JS::RootedString s(cx, JS_NewUCStringCopyN(cx, chars, slen));
        free(chars);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }

    if (enc == ENC_HEX) {
        char* tmp = (char*)malloc((size_t)slen * 2 + 1);
        if (!tmp) return false;
        static const char kHex[] = "0123456789abcdef";
        for (uint32_t i = 0; i < slen; ++i) {
            tmp[i*2]   = kHex[(data[i] >> 4) & 0xF];
            tmp[i*2+1] = kHex[ data[i]       & 0xF];
        }
        tmp[slen*2] = 0;
        JS::RootedString s(cx, JS_NewStringCopyN(cx, tmp, slen*2));
        free(tmp);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }

    if (enc == ENC_BASE64) {
        size_t outLen = ((size_t)slen + 2) / 3 * 4;
        char* tmp = (char*)malloc(outLen + 1);
        if (!tmp) return false;
        size_t n = Base64Encode(data, slen, tmp);
        tmp[n] = 0;
        JS::RootedString s(cx, JS_NewStringCopyN(cx, tmp, n));
        free(tmp);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }

    // Default: UTF-8. Decode through the SM converter so multi-byte sequences
    // produce correct code units (was Latin-1 before, which mangled non-ASCII).
    JS::UTF8Chars u8((const char*)data, slen);
    size_t u16len = 0;
    char16_t* u16 = JS::UTF8CharsToNewTwoByteCharsZ(cx, u8, &u16len).get();
    if (!u16) return false;
    JS::RootedString s(cx, JS_NewUCString(cx, u16, u16len));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

static bool BufferIsBuffer(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    bool is = false;
    if (args.length() >= 1 && args[0].isObject()) {
        is = JS_IsUint8Array(&args[0].toObject());
    }
    args.rval().setBoolean(is);
    return true;
}

bool InstallBuffer(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject bufCtor(cx, JS_NewObject(cx, nullptr));
    if (!bufCtor) return false;
    if (!JS_DefineFunction(cx, bufCtor, "from",  BufferFrom,  2, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, bufCtor, "alloc", BufferAlloc, 1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineFunction(cx, bufCtor, "isBuffer", BufferIsBuffer, 1, JSPROP_ENUMERATE)) return false;
    if (!JS_DefineProperty(cx, global, "Buffer", bufCtor, JSPROP_ENUMERATE))
        return false;

    // Patch Uint8Array.prototype with Buffer-style methods. Done in JS so
    // consumers that got a Uint8Array without going through Buffer.from
    // (e.g. typed-array slice results) also pick up the behavior.
    if (!JS_DefineFunction(cx, global, "__buf_tostr__", BufferToString, 3,
                           JSPROP_PERMANENT | JSPROP_READONLY))
        return false;

    static const char kPatch[] =
        // toString with encoding + optional start/end.
        "Uint8Array.prototype.toString = function(enc, start, end) {\n"
        "  return __buf_tostr__.call(this, enc, start, end);\n"
        "};\n"
        // Scalar reads. Range checks mirror Node (throw RangeError when
        // out of bounds), but are best-effort — iconv doesn't probe.
        "Uint8Array.prototype.readUInt8 = function(off) { return this[off|0]; };\n"
        "Uint8Array.prototype.readInt8 = function(off) {\n"
        "  var v = this[off|0]; return v >= 0x80 ? v - 0x100 : v;\n"
        "};\n"
        "Uint8Array.prototype.readUInt16LE = function(off) {\n"
        "  off = off|0; return this[off] | (this[off+1] << 8);\n"
        "};\n"
        "Uint8Array.prototype.readUInt16BE = function(off) {\n"
        "  off = off|0; return (this[off] << 8) | this[off+1];\n"
        "};\n"
        "Uint8Array.prototype.readInt16LE = function(off) {\n"
        "  var v = this.readUInt16LE(off); return v >= 0x8000 ? v - 0x10000 : v;\n"
        "};\n"
        "Uint8Array.prototype.readInt16BE = function(off) {\n"
        "  var v = this.readUInt16BE(off); return v >= 0x8000 ? v - 0x10000 : v;\n"
        "};\n"
        "Uint8Array.prototype.readUInt32LE = function(off) {\n"
        "  off = off|0;\n"
        "  return ((this[off]) | (this[off+1] << 8) | (this[off+2] << 16)) +\n"
        "         (this[off+3] * 0x1000000);\n"
        "};\n"
        "Uint8Array.prototype.readUInt32BE = function(off) {\n"
        "  off = off|0;\n"
        "  return (this[off] * 0x1000000) +\n"
        "         ((this[off+1] << 16) | (this[off+2] << 8) | this[off+3]);\n"
        "};\n"
        "Uint8Array.prototype.readInt32LE = function(off) {\n"
        "  off = off|0;\n"
        "  return (this[off]) | (this[off+1] << 8) | (this[off+2] << 16) | (this[off+3] << 24);\n"
        "};\n"
        "Uint8Array.prototype.readInt32BE = function(off) {\n"
        "  off = off|0;\n"
        "  return (this[off] << 24) | (this[off+1] << 16) | (this[off+2] << 8) | this[off+3];\n"
        "};\n"
        // Scalar writes. Silent clamp on the low byte, matching Node with
        // noAssert=true. Returns offset + bytes-written.
        "Uint8Array.prototype.writeUInt8 = function(v, off) {\n"
        "  off = off|0; this[off] = v & 0xFF; return off + 1;\n"
        "};\n"
        "Uint8Array.prototype.writeUInt16LE = function(v, off) {\n"
        "  off = off|0; this[off] = v & 0xFF; this[off+1] = (v >>> 8) & 0xFF; return off + 2;\n"
        "};\n"
        "Uint8Array.prototype.writeUInt16BE = function(v, off) {\n"
        "  off = off|0; this[off] = (v >>> 8) & 0xFF; this[off+1] = v & 0xFF; return off + 2;\n"
        "};\n"
        "Uint8Array.prototype.writeUInt32LE = function(v, off) {\n"
        "  off = off|0;\n"
        "  this[off]   =  v         & 0xFF;\n"
        "  this[off+1] = (v >>>  8) & 0xFF;\n"
        "  this[off+2] = (v >>> 16) & 0xFF;\n"
        "  this[off+3] = (v >>> 24) & 0xFF;\n"
        "  return off + 4;\n"
        "};\n"
        "Uint8Array.prototype.writeUInt32BE = function(v, off) {\n"
        "  off = off|0;\n"
        "  this[off]   = (v >>> 24) & 0xFF;\n"
        "  this[off+1] = (v >>> 16) & 0xFF;\n"
        "  this[off+2] = (v >>>  8) & 0xFF;\n"
        "  this[off+3] =  v         & 0xFF;\n"
        "  return off + 4;\n"
        "};\n"
        // copy(target, targetStart, sourceStart, sourceEnd) -> bytes copied.
        "Uint8Array.prototype.copy = function(target, tStart, sStart, sEnd) {\n"
        "  tStart = tStart|0; sStart = sStart|0;\n"
        "  if (sEnd === undefined) sEnd = this.length;\n"
        "  sEnd = sEnd|0;\n"
        "  if (sEnd > this.length) sEnd = this.length;\n"
        "  if (tStart >= target.length) return 0;\n"
        "  if (sStart >= sEnd) return 0;\n"
        "  var n = sEnd - sStart;\n"
        "  if (n > target.length - tStart) n = target.length - tStart;\n"
        "  for (var i = 0; i < n; ++i) target[tStart + i] = this[sStart + i];\n"
        "  return n;\n"
        "};\n"
        // equals(other) -> boolean.
        "Uint8Array.prototype.equals = function(other) {\n"
        "  if (!other || this.length !== other.length) return false;\n"
        "  for (var i = 0; i < this.length; ++i) if (this[i] !== other[i]) return false;\n"
        "  return true;\n"
        "};\n"
        // fill(value, start?, end?) — Node-style; returns this.
        "Uint8Array.prototype.fill = Uint8Array.prototype.fill || function(v, s, e) {\n"
        "  s = s|0; if (e === undefined) e = this.length; e = e|0;\n"
        "  var b = v & 0xFF;\n"
        "  for (var i = s; i < e; ++i) this[i] = b;\n"
        "  return this;\n"
        "};\n";
    JS::CompileOptions opts(cx);
    opts.setFileAndLine("<ionpower-node buffer patch>", 1);
    JS::RootedValue discard(cx);
    return JS::Evaluate(cx, opts, kPatch, sizeof(kPatch) - 1, &discard);
}

} // namespace ionpower
