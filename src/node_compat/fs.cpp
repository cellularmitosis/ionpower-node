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
#include <sys/time.h>
#include <fcntl.h>
#include <limits.h>

#include "jsapi.h"
#include "jsfriendapi.h"
#include "js/Conversions.h"
#include "js/CharacterEncoding.h"

namespace ionpower {

// Translate errno to Node's SYS-level code string. Keep this short —
// we only cover the codes libraries actually branch on.
static const char* ErrnoToNodeCode(int e) {
    switch (e) {
        case ENOENT:    return "ENOENT";
        case EEXIST:    return "EEXIST";
        case EACCES:    return "EACCES";
        case EISDIR:    return "EISDIR";
        case ENOTDIR:   return "ENOTDIR";
        case ENOTEMPTY: return "ENOTEMPTY";
        case EPERM:     return "EPERM";
        case EIO:       return "EIO";
        case EMFILE:    return "EMFILE";
        case ENAMETOOLONG: return "ENAMETOOLONG";
        case EINVAL:    return "EINVAL";
        case EBADF:     return "EBADF";
        case EAGAIN:    return "EAGAIN";
        case EINTR:     return "EINTR";
        case EBUSY:     return "EBUSY";
        case ENOSPC:    return "ENOSPC";
        case EROFS:     return "EROFS";
        case ELOOP:     return "ELOOP";
        case EXDEV:     return "EXDEV";
        case EPIPE:     return "EPIPE";
        case ENXIO:     return "ENXIO";
        default:        return "UNKNOWN";
    }
}

// Throw a Node-flavored fs error: Error object carrying `.code`,
// `.errno`, `.syscall`, `.path` props. mkdirp-classic and friends
// switch on err.code; the plain JS_ReportError path leaves `.code`
// undefined and their recovery logic silently breaks.
static bool ThrowFsError(JSContext* cx, int e, const char* syscall, const char* path) {
    char msg[512];
    snprintf(msg, sizeof(msg), "%s: %s, %s '%s'",
             ErrnoToNodeCode(e), strerror(e), syscall, path ? path : "");

    // Grab the global Error constructor.
    JS::RootedObject global(cx, JS::CurrentGlobalOrNull(cx));
    if (!global) { JS_ReportError(cx, "%s", msg); return false; }
    JS::RootedValue ctorVal(cx);
    if (!JS_GetProperty(cx, global, "Error", &ctorVal) || !ctorVal.isObject()) {
        JS_ReportError(cx, "%s", msg); return false;
    }
    JS::RootedObject ctor(cx, &ctorVal.toObject());
    JS::RootedString msgStr(cx, JS_NewStringCopyZ(cx, msg));
    if (!msgStr) { JS_ReportError(cx, "%s", msg); return false; }
    JS::AutoValueArray<1> ctorArgs(cx);
    ctorArgs[0].setString(msgStr);
    JS::RootedObject errObj(cx, JS_New(cx, ctor, ctorArgs));
    if (!errObj) { JS_ReportError(cx, "%s", msg); return false; }

    // Attach Node-style props. Drop failures silently; the Error itself
    // still makes it up the stack.
    JS::RootedString codeStr(cx, JS_NewStringCopyZ(cx, ErrnoToNodeCode(e)));
    if (codeStr) {
        JS::RootedValue v(cx, JS::StringValue(codeStr));
        JS_DefineProperty(cx, errObj, "code", v, JSPROP_ENUMERATE);
    }
    if (syscall) {
        JS::RootedString sysStr(cx, JS_NewStringCopyZ(cx, syscall));
        if (sysStr) {
            JS::RootedValue v(cx, JS::StringValue(sysStr));
            JS_DefineProperty(cx, errObj, "syscall", v, JSPROP_ENUMERATE);
        }
    }
    if (path) {
        JS::RootedString pathStr(cx, JS_NewStringCopyZ(cx, path));
        if (pathStr) {
            JS::RootedValue v(cx, JS::StringValue(pathStr));
            JS_DefineProperty(cx, errObj, "path", v, JSPROP_ENUMERATE);
        }
    }
    JS::RootedValue errnoVal(cx, JS::Int32Value(-e));
    JS_DefineProperty(cx, errObj, "errno", errnoVal, JSPROP_ENUMERATE);

    JS::RootedValue errVal(cx, JS::ObjectValue(*errObj));
    JS_SetPendingException(cx, errVal);
    return false;
}

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
        return ThrowFsError(cx, errno ? errno : ENOENT, "open", path.ptr());
    }

    if (wantString) {
        // Node's fs.readFileSync(path, "utf8") decodes UTF-8. JS_NewStringCopyN
        // takes Latin-1, which mangles anything > U+007F. Go through
        // UTF8CharsToNewTwoByteCharsZ to produce a proper JS string.
        size_t u16len = 0;
        JS::UTF8Chars u8((const char*)bytes, len);
        char16_t* u16 = JS::UTF8CharsToNewTwoByteCharsZ(cx, u8, &u16len).get();
        free(bytes);
        if (!u16) return false;   // cx has the conversion error
        JS::RootedString s(cx, JS_NewUCString(cx, u16, u16len));  // takes ownership
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
        // Use ThrowFsError so err.code is set — graceful-fs / glob /
        // npm.load() branch on it. Plain JS_ReportError leaves .code
        // undefined and an empty-dir ENOENT becomes a fatal "unknown".
        return ThrowFsError(cx, errno, "scandir", path.ptr());
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
        return ThrowFsError(cx, errno, "stat", path.ptr());
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
    /* Node returns time fields as Date objects (with *Ms numeric variants).
       We expose milliseconds here as raw numbers; the JS bootstrap wraps
       statSync/lstatSync to box mtime/atime/ctime/birthtime into Dates and
       set mtimeMs/atimeMs/ctimeMs/birthtimeMs alongside. lockfile + many
       npm internals do `st.ctime.getTime()`, so the Date wrapping is
       load-bearing. */
    if (!defineNum("mtimeMs", (double)st.st_mtime * 1000.0)) return false;
    if (!defineNum("atimeMs", (double)st.st_atime * 1000.0)) return false;
    if (!defineNum("ctimeMs", (double)st.st_ctime * 1000.0)) return false;
    /* No native birthtime on POSIX; approximate as ctime (Node does the
       same on platforms that don't expose it). */
    if (!defineNum("birthtimeMs", (double)st.st_ctime * 1000.0)) return false;
    if (!defineNum("mode",  (double)st.st_mode))  return false;
    // Also keep boolean shorthand (earlier consumers of our shim did
    // st.isFile as a bool). Node returns these as predicate functions,
    // though, so we install the functions below in the JS bootstrap.
    if (!defineBoolProp("isFile",      S_ISREG(st.st_mode))) return false;
    if (!defineBoolProp("isDirectory", S_ISDIR(st.st_mode))) return false;
    // Also add _mode bits so the bootstrap can wrap them as fn() style.
    if (!defineBoolProp("_isFile",      S_ISREG(st.st_mode))) return false;
    if (!defineBoolProp("_isDirectory", S_ISDIR(st.st_mode))) return false;
    if (!defineBoolProp("_isSymbolicLink", S_ISLNK(st.st_mode))) return false;

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
        return ThrowFsError(cx, errno, "unlink", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// Create `base/[a/[b/...]]`. Used by mkdirSync in { recursive: true } mode.
static int MkdirRecursive(const char* path) {
    if (!*path) return 0;
    char buf[PATH_MAX];
    size_t n = strlen(path);
    if (n >= sizeof buf) { errno = ENAMETOOLONG; return -1; }
    memcpy(buf, path, n + 1);
    // Iterate each '/' boundary and mkdir the prefix.
    for (size_t i = 1; i <= n; ++i) {
        if (buf[i] == '/' || buf[i] == '\0') {
            char saved = buf[i];
            buf[i] = 0;
            if (mkdir(buf, 0755) != 0 && errno != EEXIST) return -1;
            buf[i] = saved;
        }
    }
    return 0;
}

static bool FsMkdirSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.mkdirSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;

    bool recursive = false;
    if (args.length() >= 2 && args[1].isObject()) {
        JS::RootedObject opts(cx, &args[1].toObject());
        JS::RootedValue v(cx);
        if (!JS_GetProperty(cx, opts, "recursive", &v)) return false;
        if (v.isBoolean()) recursive = v.toBoolean();
    }

    int rc = recursive ? MkdirRecursive(path.ptr())
                       : mkdir(path.ptr(), 0755);
    if (rc != 0) {
        return ThrowFsError(cx, errno, "mkdir", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

static bool FsRmdirSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.rmdirSync: path required");
        return false;
    }
    JS::RootedString pathStr(cx, JS::ToString(cx, args[0]));
    if (!pathStr) return false;
    JSAutoByteString path(cx, pathStr);
    if (!path) return false;
    if (rmdir(path.ptr()) != 0) {
        return ThrowFsError(cx, errno, "rmdir", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// Append data to path. Creates the file if missing.
static bool FsAppendFileSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.appendFileSync: path and data required");
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
        JS::RootedString s(cx, JS::ToString(cx, args[1]));
        if (!s) return false;
        if (!strBytes.encodeUtf8(cx, s)) return false;
        data = (const uint8_t*)strBytes.ptr();
        len = strlen(strBytes.ptr());
    }

    int fd = open(path.ptr(), O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd < 0) {
        JS_ReportError(cx, "fs.appendFileSync: open %s: %s",
                       path.ptr(), strerror(errno));
        return false;
    }
    size_t off = 0;
    while (off < len) {
        ssize_t w = write(fd, data + off, len - off);
        if (w < 0) {
            if (errno == EINTR) continue;
            close(fd);
            JS_ReportError(cx, "fs.appendFileSync: write: %s", strerror(errno));
            return false;
        }
        off += (size_t)w;
    }
    close(fd);
    args.rval().setUndefined();
    return true;
}

static bool FsCopyFileSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.copyFileSync: src and dest required");
        return false;
    }
    JS::RootedString srcS(cx, JS::ToString(cx, args[0]));
    JS::RootedString dstS(cx, JS::ToString(cx, args[1]));
    if (!srcS || !dstS) return false;
    JSAutoByteString src(cx, srcS), dst(cx, dstS);
    if (!src || !dst) return false;

    int sfd = open(src.ptr(), O_RDONLY);
    if (sfd < 0) {
        JS_ReportError(cx, "fs.copyFileSync: open %s: %s",
                       src.ptr(), strerror(errno));
        return false;
    }
    int dfd = open(dst.ptr(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (dfd < 0) {
        close(sfd);
        JS_ReportError(cx, "fs.copyFileSync: open %s: %s",
                       dst.ptr(), strerror(errno));
        return false;
    }
    char buf[64 * 1024];
    for (;;) {
        ssize_t r = read(sfd, buf, sizeof buf);
        if (r == 0) break;
        if (r < 0) {
            if (errno == EINTR) continue;
            close(sfd); close(dfd);
            JS_ReportError(cx, "fs.copyFileSync: read: %s", strerror(errno));
            return false;
        }
        ssize_t off = 0;
        while (off < r) {
            ssize_t w = write(dfd, buf + off, (size_t)(r - off));
            if (w < 0) {
                if (errno == EINTR) continue;
                close(sfd); close(dfd);
                JS_ReportError(cx, "fs.copyFileSync: write: %s", strerror(errno));
                return false;
            }
            off += w;
        }
    }
    close(sfd); close(dfd);
    args.rval().setUndefined();
    return true;
}

static bool FsChmodSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.chmodSync: path and mode required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;
    uint32_t mode = 0;
    if (!JS::ToUint32(cx, args[1], &mode)) return false;
    if (chmod(path.ptr(), (mode_t)(mode & 07777)) != 0) {
        JS_ReportError(cx, "fs.chmodSync: %s: %s", path.ptr(), strerror(errno));
        return false;
    }
    args.rval().setUndefined();
    return true;
}

// readlink(2) — read the contents of a symbolic link. Returns the link
// target as a string. Throws ENOENT / EINVAL via Node-shaped Error.
static bool FsReadlinkSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.readlinkSync: path required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;

    char buf[PATH_MAX];
    ssize_t n = readlink(path.ptr(), buf, sizeof buf - 1);
    if (n < 0) {
        return ThrowFsError(cx, errno, "readlink", path.ptr());
    }
    buf[n] = 0;
    JS::RootedString s(cx, JS_NewStringCopyZ(cx, buf));
    if (!s) return false;
    args.rval().setString(s);
    return true;
}

// truncate(2) — set the file's length to `len` (default 0).
static bool FsTruncateSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.truncateSync: path required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;
    int64_t len = 0;
    if (args.length() >= 2 && !args[1].isUndefined()) {
        double d;
        if (!JS::ToNumber(cx, args[1], &d)) return false;
        len = (int64_t)d;
    }
    if (truncate(path.ptr(), (off_t)len) != 0) {
        return ThrowFsError(cx, errno, "truncate", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// symlink(2) — create a symbolic link at `linkPath` pointing to `target`.
// Node passes (target, linkPath, [type]); the `type` arg is win32-only and
// ignored on POSIX.
static bool FsSymlinkSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.symlinkSync: target and path required");
        return false;
    }
    JS::RootedString targetS(cx, JS::ToString(cx, args[0]));
    JS::RootedString linkS(cx, JS::ToString(cx, args[1]));
    if (!targetS || !linkS) return false;
    JSAutoByteString target(cx, targetS), link(cx, linkS);
    if (!target || !link) return false;
    if (symlink(target.ptr(), link.ptr()) != 0) {
        return ThrowFsError(cx, errno, "symlink", link.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// chown(2) — change file ownership.
static bool FsChownSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 3) {
        JS_ReportError(cx, "fs.chownSync: path, uid, gid required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;
    int32_t uid = 0, gid = 0;
    if (!JS::ToInt32(cx, args[1], &uid)) return false;
    if (!JS::ToInt32(cx, args[2], &gid)) return false;
    if (chown(path.ptr(), (uid_t)uid, (gid_t)gid) != 0) {
        return ThrowFsError(cx, errno, "chown", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// utimes(2) — set access + modification timestamps. Node accepts numbers
// (seconds since epoch) or Date objects; we coerce to number.
static bool FsUtimesSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 3) {
        JS_ReportError(cx, "fs.utimesSync: path, atime, mtime required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;
    double atime = 0, mtime = 0;
    if (!JS::ToNumber(cx, args[1], &atime)) return false;
    if (!JS::ToNumber(cx, args[2], &mtime)) return false;
    // Node passes seconds; struct timeval expects sec + usec.
    struct timeval tv[2];
    tv[0].tv_sec  = (long)atime;
    tv[0].tv_usec = (long)((atime - (double)tv[0].tv_sec) * 1e6);
    tv[1].tv_sec  = (long)mtime;
    tv[1].tv_usec = (long)((mtime - (double)tv[1].tv_sec) * 1e6);
    if (utimes(path.ptr(), tv) != 0) {
        return ThrowFsError(cx, errno, "utimes", path.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// link(2) — create a hard link. npm's `lockfile` package uses it for
// atomic lock creation: `link(srcPath, lockPath)` succeeds only if
// lockPath doesn't already exist (POSIX guarantee).
static bool FsLinkSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.linkSync: existingPath, newPath required");
        return false;
    }
    JS::RootedString srcS(cx, JS::ToString(cx, args[0]));
    JS::RootedString dstS(cx, JS::ToString(cx, args[1]));
    if (!srcS || !dstS) return false;
    JSAutoByteString src(cx, srcS), dst(cx, dstS);
    if (!src || !dst) return false;
    if (link(src.ptr(), dst.ptr()) != 0) {
        return ThrowFsError(cx, errno, "link", dst.ptr());
    }
    args.rval().setUndefined();
    return true;
}

// futimes(2) — set access + modification timestamps via fd. tar's
// unpack uses this to restore mtime on freshly extracted files.
static bool FsFutimesSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 3) {
        JS_ReportError(cx, "fs.futimesSync: fd, atime, mtime required");
        return false;
    }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    double atime = 0, mtime = 0;
    if (!JS::ToNumber(cx, args[1], &atime)) return false;
    if (!JS::ToNumber(cx, args[2], &mtime)) return false;
    struct timeval tv[2];
    tv[0].tv_sec  = (long)atime;
    tv[0].tv_usec = (long)((atime - (double)tv[0].tv_sec) * 1e6);
    tv[1].tv_sec  = (long)mtime;
    tv[1].tv_usec = (long)((mtime - (double)tv[1].tv_sec) * 1e6);
    if (futimes(fd, tv) != 0) {
        char buf[32];
        snprintf(buf, sizeof buf, "fd %d", fd);
        return ThrowFsError(cx, errno, "futimes", buf);
    }
    args.rval().setUndefined();
    return true;
}

// fchmod(2) — change permissions on an open file descriptor. Mirrors
// chmodSync's argument shape but takes a numeric fd instead of a path.
static bool FsFchmodSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.fchmodSync: fd and mode required");
        return false;
    }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    uint32_t mode = 0;
    if (!JS::ToUint32(cx, args[1], &mode)) return false;
    if (fchmod(fd, (mode_t)(mode & 07777)) != 0) {
        char buf[32];
        snprintf(buf, sizeof buf, "fd %d", fd);
        return ThrowFsError(cx, errno, "fchmod", buf);
    }
    args.rval().setUndefined();
    return true;
}

static bool FsRenameSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.renameSync: oldPath and newPath required");
        return false;
    }
    JS::RootedString oldStr(cx, JS::ToString(cx, args[0]));
    JS::RootedString newStr(cx, JS::ToString(cx, args[1]));
    if (!oldStr || !newStr) return false;
    JSAutoByteString oldP(cx, oldStr), newP(cx, newStr);
    if (!oldP || !newP) return false;
    if (rename(oldP.ptr(), newP.ptr()) != 0) {
        JS_ReportError(cx, "fs.renameSync: %s -> %s: %s",
                       oldP.ptr(), newP.ptr(), strerror(errno));
        return false;
    }
    args.rval().setUndefined();
    return true;
}

// fs.openSync(path, flags, [mode]) -> fd (number).
// flags: numeric POSIX or Node-style string ('r', 'w', 'a', etc.).
// Default mode 0666 (Node default; subject to umask).
static int ParseOpenFlags(const char* s) {
    if (!s) return -1;
    // Common Node strings. POSIX-only — Node also supports 'rs' (sync read)
    // which is identical for our purposes (no buffering distinction).
    if (!strcmp(s, "r"))   return O_RDONLY;
    if (!strcmp(s, "rs"))  return O_RDONLY;
    if (!strcmp(s, "r+"))  return O_RDWR;
    if (!strcmp(s, "rs+")) return O_RDWR;
    if (!strcmp(s, "w"))   return O_WRONLY | O_CREAT | O_TRUNC;
    if (!strcmp(s, "wx"))  return O_WRONLY | O_CREAT | O_TRUNC | O_EXCL;
    if (!strcmp(s, "w+"))  return O_RDWR   | O_CREAT | O_TRUNC;
    if (!strcmp(s, "wx+")) return O_RDWR   | O_CREAT | O_TRUNC | O_EXCL;
    if (!strcmp(s, "a"))   return O_WRONLY | O_CREAT | O_APPEND;
    if (!strcmp(s, "ax"))  return O_WRONLY | O_CREAT | O_APPEND | O_EXCL;
    if (!strcmp(s, "a+"))  return O_RDWR   | O_CREAT | O_APPEND;
    if (!strcmp(s, "ax+")) return O_RDWR   | O_CREAT | O_APPEND | O_EXCL;
    return -1;
}

static bool FsOpenSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.openSync: path required");
        return false;
    }
    JS::RootedString pathS(cx, JS::ToString(cx, args[0]));
    if (!pathS) return false;
    JSAutoByteString path(cx, pathS);
    if (!path) return false;

    // Default flags: 'r' (read-only).
    int flags = O_RDONLY;
    if (args.length() >= 2 && !args[1].isUndefined()) {
        if (args[1].isString()) {
            JS::RootedString fS(cx, args[1].toString());
            JSAutoByteString fB(cx, fS);
            if (!fB) return false;
            flags = ParseOpenFlags(fB.ptr());
            if (flags < 0) {
                JS_ReportError(cx, "fs.openSync: unknown flags '%s'", fB.ptr());
                return false;
            }
        } else {
            int32_t f = 0;
            if (!JS::ToInt32(cx, args[1], &f)) return false;
            flags = f;
        }
    }

    uint32_t mode = 0666;
    if (args.length() >= 3 && !args[2].isUndefined()) {
        if (!JS::ToUint32(cx, args[2], &mode)) return false;
    }

    int fd = open(path.ptr(), flags, (mode_t)(mode & 07777));
    if (fd < 0) {
        return ThrowFsError(cx, errno, "open", path.ptr());
    }
    args.rval().setInt32(fd);
    return true;
}

static bool FsCloseSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        JS_ReportError(cx, "fs.closeSync: fd required");
        return false;
    }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    if (close(fd) != 0) {
        char buf[32];
        snprintf(buf, sizeof buf, "fd %d", fd);
        return ThrowFsError(cx, errno, "close", buf);
    }
    args.rval().setUndefined();
    return true;
}

// fs.readSync(fd, buffer, offset, length, position) -> bytesRead
// position null or undefined means "current file position" (no lseek).
static bool FsReadSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 4) {
        JS_ReportError(cx, "fs.readSync: fd, buffer, offset, length required");
        return false;
    }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;
    if (!args[1].isObject() || !JS_IsUint8Array(&args[1].toObject())) {
        JS_ReportError(cx, "fs.readSync: buffer must be Uint8Array");
        return false;
    }
    JS::RootedObject buf(cx, &args[1].toObject());
    uint32_t offset = 0, length = 0;
    if (!JS::ToUint32(cx, args[2], &offset)) return false;
    if (!JS::ToUint32(cx, args[3], &length)) return false;

    size_t bufLen = JS_GetTypedArrayByteLength(buf);
    if ((size_t)offset + (size_t)length > bufLen) {
        JS_ReportError(cx,
            "fs.readSync: offset+length (%u+%u) exceeds buffer size (%zu)",
            offset, length, bufLen);
        return false;
    }

    bool hasPos = (args.length() >= 5 && !args[4].isNullOrUndefined());
    int64_t pos = 0;
    if (hasPos) {
        double d;
        if (!JS::ToNumber(cx, args[4], &d)) return false;
        pos = (int64_t)d;
    }

    ssize_t n;
    {
        JS::AutoCheckCannotGC nogc;
        bool sharedDummy;
        uint8_t* data = JS_GetUint8ArrayData(buf, &sharedDummy, nogc);
        if (!data) {
            JS_ReportError(cx, "fs.readSync: cannot access buffer data");
            return false;
        }
        if (hasPos) {
            n = pread(fd, data + offset, length, (off_t)pos);
        } else {
            n = read(fd, data + offset, length);
        }
    }
    if (n < 0) {
        char buf2[32];
        snprintf(buf2, sizeof buf2, "fd %d", fd);
        return ThrowFsError(cx, errno, "read", buf2);
    }
    args.rval().setInt32((int32_t)n);
    return true;
}

// fs.writeSync(fd, buffer, offset, length, position) -> bytesWritten
// fs.writeSync(fd, string, position, encoding)       -> bytesWritten
static bool FsWriteSync(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "fs.writeSync: fd and buffer/string required");
        return false;
    }
    int32_t fd = 0;
    if (!JS::ToInt32(cx, args[0], &fd)) return false;

    bool isString = args[1].isString();
    bool isU8     = args[1].isObject() && JS_IsUint8Array(&args[1].toObject());
    if (!isString && !isU8) {
        JS_ReportError(cx, "fs.writeSync: data must be Buffer or string");
        return false;
    }

    // Position: arg[4] for buffer form, arg[2] for string form.
    bool hasPos = false;
    int64_t pos = 0;

    const uint8_t* data = nullptr;
    size_t writeLen = 0;
    JSAutoByteString strBytes;

    if (isU8) {
        JS::RootedObject buf(cx, &args[1].toObject());
        size_t bufLen = JS_GetTypedArrayByteLength(buf);
        uint32_t offset = 0;
        uint32_t length = (uint32_t)bufLen;
        if (args.length() >= 3 && !args[2].isNullOrUndefined()) {
            if (!JS::ToUint32(cx, args[2], &offset)) return false;
        }
        if (args.length() >= 4 && !args[3].isNullOrUndefined()) {
            if (!JS::ToUint32(cx, args[3], &length)) return false;
        }
        if ((size_t)offset + (size_t)length > bufLen) {
            JS_ReportError(cx,
                "fs.writeSync: offset+length (%u+%u) exceeds buffer size (%zu)",
                offset, length, bufLen);
            return false;
        }
        if (args.length() >= 5 && !args[4].isNullOrUndefined()) {
            hasPos = true;
            double d;
            if (!JS::ToNumber(cx, args[4], &d)) return false;
            pos = (int64_t)d;
        }
        // GC-safe access scope held until pwrite/write returns.
        ssize_t n;
        {
            JS::AutoCheckCannotGC nogc;
            bool sharedDummy;
            data = JS_GetUint8ArrayData(buf, &sharedDummy, nogc);
            if (!data) {
                JS_ReportError(cx, "fs.writeSync: cannot access buffer data");
                return false;
            }
            if (hasPos) {
                n = pwrite(fd, data + offset, length, (off_t)pos);
            } else {
                n = write(fd, data + offset, length);
            }
        }
        if (n < 0) {
            char buf2[32];
            snprintf(buf2, sizeof buf2, "fd %d", fd);
            return ThrowFsError(cx, errno, "write", buf2);
        }
        args.rval().setInt32((int32_t)n);
        return true;
    }

    // String form.
    JS::RootedString s(cx, args[1].toString());
    if (!strBytes.encodeUtf8(cx, s)) return false;
    data = (const uint8_t*)strBytes.ptr();
    writeLen = strlen(strBytes.ptr());
    if (args.length() >= 3 && !args[2].isNullOrUndefined()) {
        hasPos = true;
        double d;
        if (!JS::ToNumber(cx, args[2], &d)) return false;
        pos = (int64_t)d;
    }
    // arg[3] = encoding; we only support utf8 (encodeUtf8 above).
    ssize_t n = hasPos ? pwrite(fd, data, writeLen, (off_t)pos)
                       : write(fd, data, writeLen);
    if (n < 0) {
        char buf2[32];
        snprintf(buf2, sizeof buf2, "fd %d", fd);
        return ThrowFsError(cx, errno, "write", buf2);
    }
    args.rval().setInt32((int32_t)n);
    return true;
}

static const JSFunctionSpec kFsFuncs[] = {
    JS_FN("readFileSync",  FsReadFileSync,  2, 0),
    JS_FN("writeFileSync", FsWriteFileSync, 3, 0),
    JS_FN("existsSync",    FsExistsSync,    1, 0),
    JS_FN("readdirSync",   FsReaddirSync,   1, 0),
    JS_FN("statSync",      FsStatSync,      1, 0),
    JS_FN("unlinkSync",    FsUnlinkSync,    1, 0),
    JS_FN("mkdirSync",     FsMkdirSync,     2, 0),
    JS_FN("rmdirSync",     FsRmdirSync,     1, 0),
    JS_FN("renameSync",     FsRenameSync,     2, 0),
    JS_FN("appendFileSync", FsAppendFileSync, 2, 0),
    JS_FN("copyFileSync",   FsCopyFileSync,   2, 0),
    JS_FN("chmodSync",      FsChmodSync,      2, 0),
    JS_FN("readlinkSync",   FsReadlinkSync,   1, 0),
    JS_FN("truncateSync",   FsTruncateSync,   2, 0),
    JS_FN("symlinkSync",    FsSymlinkSync,    3, 0),
    JS_FN("chownSync",      FsChownSync,      3, 0),
    JS_FN("utimesSync",     FsUtimesSync,     3, 0),
    JS_FN("futimesSync",    FsFutimesSync,    3, 0),
    JS_FN("linkSync",       FsLinkSync,       2, 0),
    JS_FN("fchmodSync",     FsFchmodSync,     2, 0),
    JS_FN("openSync",       FsOpenSync,       3, 0),
    JS_FN("closeSync",      FsCloseSync,      1, 0),
    JS_FN("readSync",       FsReadSync,       5, 0),
    JS_FN("writeSync",      FsWriteSync,      5, 0),
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
