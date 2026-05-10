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
    // Normalize: collapse '//', '/./', and '/foo/..' segments. Real Node's
    // path.resolve does this — without '..' collapsing, recursive walkers
    // (e.g. npm's findNearestDir, which iterates path.resolve(dir, '..'))
    // grow the path forever until PATH_MAX overflow. (Real Node also chases
    // symlinks via realpath; we don't, that's path.realpath() territory.)
    char norm[PATH_MAX]; size_t ni = 0;
    // Pass 1: collapse '//' and '/./'.
    char tmp[PATH_MAX]; size_t ti = 0;
    for (size_t i = 0; out[i]; ) {
        if (out[i] == '/' && out[i + 1] == '/') { ++i; continue; }
        if (out[i] == '/' && out[i + 1] == '.' && (out[i + 2] == '/' || out[i + 2] == 0)) {
            i += 2; continue;
        }
        if (ti + 1 >= sizeof tmp) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
        tmp[ti++] = out[i++];
    }
    tmp[ti] = 0;
    // Pass 2: collapse '/foo/..' segments. We always start with '/' (cwd or
    // an absolute arg replaced cwd). Walk segment-by-segment; on '..', pop
    // the last accepted segment (unless we're already at root, in which
    // case drop the '..' — '/..' is just '/' on Unix).
    if (ti == 0 || tmp[0] != '/') {
        // Should not happen — out always starts with '/' (cwd or absolute arg).
        // Fallback: copy as-is.
        if (ti >= sizeof norm) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
        memcpy(norm, tmp, ti); ni = ti; norm[ni] = 0;
    } else {
        norm[ni++] = '/';  // root
        size_t i = 1;
        while (i < ti) {
            // segment runs from i to next '/' or end
            size_t j = i;
            while (j < ti && tmp[j] != '/') ++j;
            size_t seglen = j - i;
            if (seglen == 2 && tmp[i] == '.' && tmp[i + 1] == '.') {
                // pop last segment from norm (if any beyond root)
                if (ni > 1) {
                    // strip trailing '/' if present
                    if (norm[ni - 1] == '/') --ni;
                    while (ni > 1 && norm[ni - 1] != '/') --ni;
                }
                // ni now points at '/' after parent (or 1 if at root)
            } else if (seglen > 0) {
                if (ni > 1 && norm[ni - 1] != '/') {
                    if (ni + 1 >= sizeof norm) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
                    norm[ni++] = '/';
                }
                if (ni + seglen >= sizeof norm) { JS_ReportError(cx, "path.resolve: overflow"); return false; }
                memcpy(norm + ni, tmp + i, seglen); ni += seglen;
            }
            i = (j < ti) ? j + 1 : j;
        }
        // Strip trailing '/' (except for root '/').
        if (ni > 1 && norm[ni - 1] == '/') --ni;
        norm[ni] = 0;
    }
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
