// path.{join,dirname,basename,extname,resolve,isAbsolute,sep}
//
// Minimal, POSIX-only. Since this runtime only runs on Tiger/PPC, we skip
// Windows forks. The canonical JS side can layer util.format on top;
// here we just do string ops in C for speed.

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <limits.h>

#include "jsapi.h"
#include "js/Conversions.h"

namespace ionpower {

static bool PathJoin(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    // Concatenate args with '/' separators; collapse consecutive '/'.
    char out[PATH_MAX];
    out[0] = 0;
    size_t used = 0;
    for (unsigned i = 0; i < args.length(); ++i) {
        JS::RootedString s(cx, JS::ToString(cx, args[i]));
        if (!s) return false;
        JSAutoByteString b(cx, s);
        if (!b) return false;
        const char* p = b.ptr();
        if (!*p) continue;
        if (used && out[used - 1] != '/') {
            if (used + 1 >= sizeof out) { JS_ReportError(cx, "path.join: overflow"); return false; }
            out[used++] = '/';
            out[used] = 0;
        }
        // Skip a leading '/' on non-first components to avoid "//".
        if (used && *p == '/') ++p;
        size_t plen = strlen(p);
        if (used + plen >= sizeof out) { JS_ReportError(cx, "path.join: overflow"); return false; }
        memcpy(out + used, p, plen);
        used += plen;
        out[used] = 0;
    }
    if (!used) { out[0] = '.'; out[1] = 0; used = 1; }
    JS::RootedString r(cx, JS_NewStringCopyN(cx, out, used));
    if (!r) return false;
    args.rval().setString(r);
    return true;
}

static bool PathDirname(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        args.rval().setString(JS_NewStringCopyZ(cx, "."));
        return true;
    }
    JS::RootedString s(cx, JS::ToString(cx, args[0]));
    if (!s) return false;
    JSAutoByteString b(cx, s);
    if (!b) return false;
    const char* p = b.ptr();
    // Strip trailing slashes.
    ssize_t end = (ssize_t)strlen(p) - 1;
    while (end > 0 && p[end] == '/') --end;
    while (end >= 0 && p[end] != '/') --end;
    if (end < 0) { args.rval().setString(JS_NewStringCopyZ(cx, ".")); return true; }
    if (end == 0) { args.rval().setString(JS_NewStringCopyZ(cx, "/")); return true; }
    JS::RootedString out(cx, JS_NewStringCopyN(cx, p, (size_t)end));
    if (!out) return false;
    args.rval().setString(out);
    return true;
}

static bool PathBasename(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { args.rval().setString(JS_NewStringCopyZ(cx, "")); return true; }
    JS::RootedString s(cx, JS::ToString(cx, args[0]));
    if (!s) return false;
    JSAutoByteString b(cx, s);
    if (!b) return false;
    const char* p = b.ptr();
    size_t len = strlen(p);
    // Strip trailing slashes.
    while (len > 1 && p[len - 1] == '/') --len;
    const char* base = p;
    for (size_t i = 0; i < len; ++i) {
        if (p[i] == '/') base = p + i + 1;
    }
    size_t baseLen = (p + len) - base;

    // Optional ext arg: strip it.
    if (args.length() >= 2 && args[1].isString()) {
        JS::RootedString extS(cx, args[1].toString());
        JSAutoByteString extB(cx, extS);
        if (!extB) return false;
        size_t el = strlen(extB.ptr());
        if (el <= baseLen && memcmp(base + baseLen - el, extB.ptr(), el) == 0)
            baseLen -= el;
    }
    JS::RootedString out(cx, JS_NewStringCopyN(cx, base, baseLen));
    if (!out) return false;
    args.rval().setString(out);
    return true;
}

static bool PathExtname(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { args.rval().setString(JS_NewStringCopyZ(cx, "")); return true; }
    JS::RootedString s(cx, JS::ToString(cx, args[0]));
    if (!s) return false;
    JSAutoByteString b(cx, s);
    if (!b) return false;
    const char* p = b.ptr();
    size_t len = strlen(p);
    // Find last '/' and last '.'.
    ssize_t lastSlash = -1, lastDot = -1;
    for (size_t i = 0; i < len; ++i) {
        if (p[i] == '/') lastSlash = (ssize_t)i;
        else if (p[i] == '.') lastDot = (ssize_t)i;
    }
    // No dot, or dot at start of filename (hidden file), or dot before slash.
    if (lastDot < 0 || lastDot <= lastSlash + 1) {
        args.rval().setString(JS_NewStringCopyZ(cx, ""));
        return true;
    }
    JS::RootedString out(cx, JS_NewStringCopyN(cx, p + lastDot, len - (size_t)lastDot));
    if (!out) return false;
    args.rval().setString(out);
    return true;
}

static bool PathResolve(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    char cwd[PATH_MAX];
    if (!getcwd(cwd, sizeof cwd)) { JS_ReportError(cx, "path.resolve: %s", strerror(errno)); return false; }
    char out[PATH_MAX];
    strncpy(out, cwd, sizeof out); out[sizeof out - 1] = 0;

    for (unsigned i = 0; i < args.length(); ++i) {
        JS::RootedString s(cx, JS::ToString(cx, args[i]));
        if (!s) return false;
        JSAutoByteString b(cx, s);
        if (!b) return false;
        const char* p = b.ptr();
        if (p[0] == '/') {
            strncpy(out, p, sizeof out); out[sizeof out - 1] = 0;
        } else {
            size_t l = strlen(out);
            if (l == 0 || out[l - 1] != '/') {
                if (l + 1 >= sizeof out) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
                out[l++] = '/'; out[l] = 0;
            }
            size_t pl = strlen(p);
            if (l + pl >= sizeof out) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
            memcpy(out + l, p, pl + 1);
        }
    }
    // Minimal normalization: collapse '//' and '/./'. ('..' left to higher
    // layers — real Node does this too but chases symlinks; we just
    // flatten dot segments.)
    char norm[PATH_MAX]; size_t ni = 0;
    for (size_t i = 0; out[i]; ) {
        if (out[i] == '/' && out[i + 1] == '/') { ++i; continue; }
        if (out[i] == '/' && out[i + 1] == '.' && (out[i + 2] == '/' || out[i + 2] == 0)) {
            i += 2; continue;
        }
        norm[ni++] = out[i++];
        if (ni >= sizeof norm) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
    }
    norm[ni] = 0;
    JS::RootedString r(cx, JS_NewStringCopyN(cx, norm, ni));
    if (!r) return false;
    args.rval().setString(r);
    return true;
}

static bool PathIsAbsolute(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) { args.rval().setBoolean(false); return true; }
    JS::RootedString s(cx, JS::ToString(cx, args[0]));
    if (!s) return false;
    JSAutoByteString b(cx, s);
    if (!b) return false;
    args.rval().setBoolean(b.ptr()[0] == '/');
    return true;
}

static const JSFunctionSpec kPathFuncs[] = {
    JS_FN("join",       PathJoin,       0, 0),
    JS_FN("dirname",    PathDirname,    1, 0),
    JS_FN("basename",   PathBasename,   2, 0),
    JS_FN("extname",    PathExtname,    1, 0),
    JS_FN("resolve",    PathResolve,    0, 0),
    JS_FN("isAbsolute", PathIsAbsolute, 1, 0),
    JS_FS_END
};

bool InstallPath(JSContext* cx, JS::HandleObject global)
{
    JS::RootedObject path(cx, JS_NewPlainObject(cx));
    if (!path) return false;
    if (!JS_DefineFunctions(cx, path, kPathFuncs)) return false;
    JS::RootedString sep(cx, JS_NewStringCopyZ(cx, "/"));
    if (!sep) return false;
    JS::RootedValue sepv(cx, JS::StringValue(sep));
    if (!JS_DefineProperty(cx, path, "sep", sepv, JSPROP_ENUMERATE)) return false;
    return JS_DefineProperty(cx, global, "__path_native__", path,
                             JSPROP_PERMANENT | JSPROP_READONLY);
}

} // namespace ionpower
