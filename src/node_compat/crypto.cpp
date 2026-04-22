// crypto (minimal): randomBytes / randomFillSync / getRandomValues.
//
// Entropy source: /dev/urandom. Tiger's libc predates arc4random_buf (that
// was added in 10.7), so we just read from the device directly. /dev/urandom
// is nonblocking and reseeds from the kernel entropy pool — appropriate for
// any non-specialized crypto consumer.

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

// Fill `buf` with `len` bytes from /dev/urandom. Returns false on I/O error.
// Caches the fd for the lifetime of the process; a single global fd is fine
// because this is all single-threaded.
static bool RandomFill(void* buf, size_t len) {
    static int urandom_fd = -1;
    if (urandom_fd < 0) {
        urandom_fd = open("/dev/urandom", O_RDONLY);
        if (urandom_fd < 0) return false;
    }
    uint8_t* p = (uint8_t*)buf;
    while (len > 0) {
        ssize_t n = read(urandom_fd, p, len);
        if (n < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        if (n == 0) return false;
        p += n;
        len -= (size_t)n;
    }
    return true;
}

static bool CryptoRandomBytes(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "crypto.randomBytes: size required");
        return false;
    }
    uint32_t n = 0;
    if (!JS::ToUint32(cx, args[0], &n)) return false;
    if (n > (1u << 24)) {
        JS_ReportError(cx, "crypto.randomBytes: size too large (> 16 MiB)");
        return false;
    }
    JS::RootedObject arr(cx, JS_NewUint8Array(cx, n));
    if (!arr) return false;
    if (n > 0) {
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        uint8_t* data = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
        if (!data) return false;
        if (!RandomFill(data, (size_t)n)) {
            JS_ReportError(cx, "crypto.randomBytes: /dev/urandom read failed: %s",
                           strerror(errno));
            return false;
        }
    }
    args.rval().setObject(*arr);
    return true;
}

// Web Crypto: crypto.getRandomValues(typedArray) — fills the array in place.
static bool CryptoGetRandomValues(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1 || !args[0].isObject()) {
        JS_ReportError(cx, "crypto.getRandomValues: typed array required");
        return false;
    }
    JS::RootedObject a(cx, &args[0].toObject());
    if (!JS_IsUint8Array(a) &&
        !JS_IsInt8Array(a)  &&
        !JS_IsUint16Array(a) &&
        !JS_IsInt16Array(a)  &&
        !JS_IsUint32Array(a) &&
        !JS_IsInt32Array(a)) {
        JS_ReportError(cx, "crypto.getRandomValues: unsupported typed array");
        return false;
    }
    uint32_t byteLen = JS_GetTypedArrayByteLength(a);
    if (byteLen > 65536) {
        // Web Crypto caps at 64 KiB; mirror the rule.
        JS_ReportError(cx, "crypto.getRandomValues: quota exceeded (64 KiB)");
        return false;
    }
    {
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        void* data = nullptr;
        if (JS_IsUint8Array(a))       data = JS_GetUint8ArrayData(a, &sharedDummy, nogc);
        else if (JS_IsInt8Array(a))   data = JS_GetInt8ArrayData(a, &sharedDummy, nogc);
        else if (JS_IsUint16Array(a)) data = JS_GetUint16ArrayData(a, &sharedDummy, nogc);
        else if (JS_IsInt16Array(a))  data = JS_GetInt16ArrayData(a, &sharedDummy, nogc);
        else if (JS_IsUint32Array(a)) data = JS_GetUint32ArrayData(a, &sharedDummy, nogc);
        else if (JS_IsInt32Array(a))  data = JS_GetInt32ArrayData(a, &sharedDummy, nogc);
        if (data && !RandomFill(data, (size_t)byteLen)) {
            JS_ReportError(cx, "crypto.getRandomValues: /dev/urandom read failed: %s",
                           strerror(errno));
            return false;
        }
    }
    args.rval().setObject(*a);  // Web Crypto returns the same array.
    return true;
}

static const JSFunctionSpec kCryptoFuncs[] = {
    JS_FN("randomBytes",     CryptoRandomBytes,     1, 0),
    JS_FN("getRandomValues", CryptoGetRandomValues, 1, 0),
    JS_FS_END
};

bool InstallCrypto(JSContext* cx, JS::HandleObject global)
{
    JS::RootedObject crypto(cx, JS_NewPlainObject(cx));
    if (!crypto) return false;
    if (!JS_DefineFunctions(cx, crypto, kCryptoFuncs)) return false;
    return JS_DefineProperty(cx, global, "__crypto_native__", crypto,
                             JSPROP_PERMANENT | JSPROP_READONLY);
}

} // namespace ionpower
