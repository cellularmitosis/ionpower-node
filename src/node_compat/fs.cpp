// fs (synchronous subset): readFileSync, writeFileSync, existsSync,
// readdirSync, statSync, unlinkSync, mkdirSync, rmdirSync.
//
// We only do string <-> string or Uint8Array <-> string at this stage.
// Node's `fs.readFileSync(path, { encoding: "utf8" })` returns a string;
// no encoding arg returns a Buffer. We honor the encoding branch and
// fake the Buffer branch as a Uint8Array — good enough for common usage.

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <dirent.h>
#include <sys/stat.h>
#include <fcntl.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"

namespace ionpower {

static bool ReadFileToBytes(const char* path, uint8_t** out, size_t* outLen)
{
    FILE* f = fopen(path, "rb");
    if (!f) return false;
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return false; }
    long sz = ftell(f);
    if (sz < 0) { fclose(f); return false; }
    rewind(f);
    uint8_t* buf = (uint8_t*)malloc((size_t)sz + 1);
    if (!buf) { fclose(f); return false; }
    size_t r = fread(buf, 1, (size_t)sz, f);
    fclose(f);
    if (r != (size_t)sz) { free(buf); return false; }
    buf[sz] = 0;
    *out = buf;
    *outLen = (size_t)sz;
    return true;
}

static bool FsReadFileSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.readFileSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;

    // Decide encoding.
    bool wantString = false;
    if (args.length() >= 2 && !args[1].isNullOrUndefined()) {
        if (args[1].isString()) {
            // fs.readFileSync(path, "utf8")
            wantString = true;
        } else if (args[1].isObject()) {
            JS::RootedObject opts(cx, &args[1].toObject());
            JS::RootedValue v(cx);
            if (!JS_GetProperty(cx, opts, "encoding", &v)) return false;
            if (v.isString()) wantString = true;
        }
    }

    uint8_t* bytes = nullptr;
    size_t len = 0;
    if (!ReadFileToBytes(path.ptr(), &bytes, &len)) {
        JS_ReportError(cx, "fs.readFileSync: %s: %s", path.ptr(), strerror(errno));
        return false;
    }

    if (wantString) {
        JS::RootedString s(cx, JS_NewStringCopyN(cx, (const char*)bytes, len));
        free(bytes);
        if (!s) return false;
        args.rval().setString(s);
        return true;
    }

    // Buffer-shaped result: Uint8Array copy.
    JS::RootedObject arr(cx, JS_NewUint8Array(cx, len));
    if (!arr) { free(bytes); return false; }
    {
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        uint8_t* out = JS_GetUint8ArrayData(arr, &sharedDummy, nogc);
        if (out) memcpy(out, bytes, len);
    }
    free(bytes);
    args.rval().setObject(*arr);
    return true;
}

static bool FsWriteFileSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.writeFileSync: path and data required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;

    const uint8_t* data = nullptr;
    size_t len = 0;
    JSAutoByteString strBytes;

    if (args[1].isString()) {
        JS::RootedString s(cx, args[1].toString());
        if (!strBytes.encodeUtf8(cx, s)) return false;
        data = (const uint8_t*)strBytes.ptr();
        len = strlen(strBytes.ptr());
    } else if (args[1].isObject() && JS_IsUint8Array(&args[1].toObject())) {
        JS::RootedObject u8(cx, &args[1].toObject());
        len = JS_GetTypedArrayByteLength(u8);
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        data = JS_GetUint8ArrayData(u8, &sharedDummy, nogc);
    } else {
        // Fall back: stringify.
        JS::RootedString s(cx, JS::ToString(cx, args[1]));
        if (!s) return false;
        if (!strBytes.encodeUtf8(cx, s)) return false;
        data = (const uint8_t*)strBytes.ptr();
        len = strlen(strBytes.ptr());
    }

    int fd = open(path.ptr(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) {
        JS_ReportError(cx, "fs.writeFileSync: open %s: %s",
                       path.ptr(), strerror(errno));
        return false;
    }
    size_t off = 0;
    while (off < len) {
        ssize_t w = write(fd, data + off, len - off);
        if (w < 0) {
            if (errno == EINTR) continue;
            close(fd);
            JS_ReportError(cx, "fs.writeFileSync: write: %s", strerror(errno));
            return false;
        }
        off += (size_t)w;
    }
    close(fd);
    args.rval().setUndefined();
    return true;
}

static bool FsExistsSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { args.rval().setBoolean(false); return true; }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;
    struct stat st;
    args.rval().setBoolean(stat(path.ptr(), &st) == 0);
    return true;
}

static bool FsReaddirSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.readdirSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;

    DIR* d = opendir(path.ptr());
    if (!d) {
        JS_ReportError(cx, "fs.readdirSync: %s: %s", path.ptr(), strerror(errno));
        return false;
    }
    JS::RootedObject arr(cx, JS_NewArrayObject(cx, 0));
    if (!arr) { closedir(d); return false; }
    unsigned idx = 0;
    struct dirent* e;
    while ((e = readdir(d))) {
        if (strcmp(e->d_name, ".") == 0 || strcmp(e->d_name, "..") == 0)
            continue;
        JS::RootedString s(cx, JS_NewStringCopyZ(cx, e->d_name));
        if (!s) { closedir(d); return false; }
        JS::RootedValue v(cx, JS::StringValue(s));
        if (!JS_SetElement(cx, arr, idx, v)) { closedir(d); return false; }
        ++idx;
    }
    closedir(d);
    args.rval().setObject(*arr);
    return true;
}

static bool FsStatSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.statSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;

    struct stat st;
    if (stat(path.ptr(), &st) != 0) {
        JS_ReportError(cx, "fs.statSync: %s: %s", path.ptr(), strerror(errno));
        return false;
    }
    JS::RootedObject out(cx, JS_NewPlainObject(cx));
    if (!out) return false;

    auto defineNum = [&](const char* k, double v) -> bool {
        JS::RootedValue vv(cx, JS::NumberValue(v));
        return JS_DefineProperty(cx, out, k, vv, JSPROP_ENUMERATE);
    };
    auto defineBoolProp = [&](const char* k, bool v) -> bool {
        JS::RootedValue vv(cx, JS::BooleanValue(v));
        return JS_DefineProperty(cx, out, k, vv, JSPROP_ENUMERATE);
    };
    if (!defineNum("size",  (double)st.st_size))  return false;
    if (!defineNum("mtime", (double)st.st_mtime * 1000.0)) return false;
    if (!defineNum("mode",  (double)st.st_mode))  return false;
    if (!defineBoolProp("isFile",      S_ISREG(st.st_mode))) return false;
    if (!defineBoolProp("isDirectory", S_ISDIR(st.st_mode))) return false;

    args.rval().setObject(*out);
    return true;
}

static bool FsUnlinkSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.unlinkSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;
    if (unlink(path.ptr()) != 0) {
        JS_ReportError(cx, "fs.unlinkSync: %s: %s", path.ptr(), strerror(errno));
        return false;
    }
    args.rval().setUndefined();
    return true;
}

static const JSFunctionSpec kFsFuncs[] = {
    JS_FN("readFileSync",  FsReadFileSync,  2, 0),
    JS_FN("writeFileSync", FsWriteFileSync, 3, 0),
    JS_FN("existsSync",    FsExistsSync,    1, 0),
    JS_FN("readdirSync",   FsReaddirSync,   1, 0),
    JS_FN("statSync",      FsStatSync,      1, 0),
    JS_FN("unlinkSync",    FsUnlinkSync,    1, 0),
    JS_FS_END
};

bool InstallFsSync(JSContext* cx, JS::HandleObject global)
{
    JS::RootedObject fs(cx, JS_NewPlainObject(cx));
    if (!fs) return false;
    if (!JS_DefineFunctions(cx, fs, kFsFuncs)) return false;
    return JS_DefineProperty(cx, global, "__fs_native__", fs,
                             JSPROP_PERMANENT | JSPROP_READONLY);
}

} // namespace ionpower
