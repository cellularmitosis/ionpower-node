// CommonJS require() for ionpower-node.
//
// Minimal by design: we support relative paths ('./foo', '../bar/baz'),
// with optional '.js' extension inference. We do NOT implement node_modules
// traversal or package.json "main" resolution yet.
//
// Behavior mirrors Node's spec for the easy cases:
//   const x = require('./x.js');   // runs ./x.js once, caches export.
//   const y = require('./y');      // tries ./y, ./y.js, ./y/index.js.
//   module.exports = { ... };      // anything you assign is cached.
//
// The module wrapper below is close to Node's:
//   (function (exports, require, module, __filename, __dirname) { <src> });
//
// A per-runtime cache lives on the global as __require_cache__, so
// subsequent require()s return the same exports object.

#include "node_compat/globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <sys/stat.h>
#include <limits.h>

#include "jsapi.h"
#include "js/CharacterEncoding.h"
#include "js/Conversions.h"

namespace ionpower {

static bool FileExists(const char* path) {
    struct stat st;
    return stat(path, &st) == 0 && S_ISREG(st.st_mode);
}

// Collapse `./` and `../` in `path` in-place. Leaves a single leading '/'
// intact if present. Used to canonicalize resolved module paths so the
// module cache and recursion-detection see identical keys regardless of
// how the caller spelled the relative path.
//
// Without this, `require('./foo')` from a module at `/a/b/` produces the
// stat-valid but non-canonical path `/a/b/./foo.js`, which then requires
// `./bar` → `/a/b/./bar.js`, which requires `./bar` → `/a/b/./././bar.js`,
// and so on forever. semver's internal requires are the shape that hits
// this.
static void CanonicalizePath(char* path) {
    if (!path || !*path) return;
    char tmp[PATH_MAX];
    size_t len = strlen(path);
    if (len >= sizeof tmp) return;

    bool absolute = (path[0] == '/');
    // Tokenize on '/' and rebuild.
    char* parts[256];
    int nparts = 0;
    size_t i = absolute ? 1 : 0;
    while (i < len && nparts < 256) {
        while (i < len && path[i] == '/') ++i;
        if (i >= len) break;
        parts[nparts++] = path + i;
        while (i < len && path[i] != '/') ++i;
        if (i < len) path[i++] = 0;
    }

    // Filter '.' and collapse '..'.
    char* kept[256];
    int nkept = 0;
    for (int k = 0; k < nparts; ++k) {
        if (strcmp(parts[k], ".") == 0) continue;
        if (strcmp(parts[k], "..") == 0) {
            if (nkept > 0) --nkept;
            // On a non-absolute path with no parents to pop, preserve ..
            else if (!absolute) kept[nkept++] = parts[k];
            continue;
        }
        kept[nkept++] = parts[k];
    }

    // Rebuild into tmp.
    size_t o = 0;
    if (absolute) tmp[o++] = '/';
    for (int k = 0; k < nkept; ++k) {
        if (o > (absolute ? 1u : 0u)) tmp[o++] = '/';
        size_t pl = strlen(kept[k]);
        if (o + pl >= sizeof tmp) return;
        memcpy(tmp + o, kept[k], pl);
        o += pl;
    }
    if (o == 0) { tmp[o++] = '.'; }
    tmp[o] = 0;
    memcpy(path, tmp, o + 1);
}

static bool DirExists(const char* path) {
    struct stat st;
    return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
}

// Find the position of the *top-level* "main" key in a package.json
// buffer. Tracks brace depth and skips over string literals so nested
// blocks like "jspm": { "main": "handlebars" } don't shadow the real
// top-level main (handlebars@4.7.8 hits this; without it, require()
// looks up node_modules/handlebars/handlebars and fails). Returns a
// pointer to the opening quote of the matching key, or nullptr.
static const char* FindTopLevelMainKey(const char* buf, size_t len) {
    int depth = 0;
    size_t i = 0;
    while (i < len) {
        char c = buf[i];
        if (c == '{') { ++depth; ++i; continue; }
        if (c == '}') { --depth; ++i; continue; }
        if (c == '[') { ++depth; ++i; continue; }
        if (c == ']') { --depth; ++i; continue; }
        if (c == '"') {
            size_t start = i + 1;
            size_t j = start;
            while (j < len && buf[j] != '"') {
                if (buf[j] == '\\' && j + 1 < len) j += 2;
                else ++j;
            }
            if (depth == 1 && j - start == 4 &&
                memcmp(buf + start, "main", 4) == 0) {
                // Confirm this is a key: ':' follows (modulo whitespace).
                size_t k = j + 1;
                while (k < len && (buf[k] == ' ' || buf[k] == '\t' ||
                                   buf[k] == '\n' || buf[k] == '\r')) ++k;
                if (k < len && buf[k] == ':') return buf + i;
            }
            i = (j < len) ? j + 1 : len;
            continue;
        }
        ++i;
    }
    return nullptr;
}

// Try "base" as a module path: "base", "base.js", "base/index.js", or
// "base/<pkg.main>" if base/package.json exists with a "main" field.
// Returns true and fills `out` on success.
static bool TryModuleExtensions(const char* base, char* out, size_t outsz) {
    if (FileExists(base)) {
        strncpy(out, base, outsz); out[outsz - 1] = 0; return true;
    }
    char candidate[PATH_MAX];
    // base + ".js"
    snprintf(candidate, sizeof candidate, "%s.js", base);
    if (FileExists(candidate)) {
        strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
    }
    // base + ".cjs"
    snprintf(candidate, sizeof candidate, "%s.cjs", base);
    if (FileExists(candidate)) {
        strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
    }
    // base + "/package.json" -> "main"
    if (DirExists(base)) {
        char pkg[PATH_MAX];
        snprintf(pkg, sizeof pkg, "%s/package.json", base);
        if (FileExists(pkg)) {
            // Very forgiving "main" reader: look for "main":"<path>" or
            // "main": "<path>". Avoid pulling in a full JSON parser here.
            FILE* f = fopen(pkg, "rb");
            if (f) {
                char buf[4096];
                size_t r = fread(buf, 1, sizeof(buf) - 1, f);
                fclose(f);
                buf[r] = 0;
                const char* p = FindTopLevelMainKey(buf, r);
                if (p) {
                    p = strchr(p, ':');
                    if (p) {
                        ++p;
                        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') ++p;
                        if (*p == '"') {
                            const char* start = p + 1;
                            const char* end = strchr(start, '"');
                            if (end) {
                                char main_path[PATH_MAX];
                                size_t n = (size_t)(end - start);
                                if (n >= sizeof main_path) n = sizeof main_path - 1;
                                memcpy(main_path, start, n);
                                main_path[n] = 0;
                                char full[PATH_MAX];
                                snprintf(full, sizeof full, "%s/%s", base, main_path);
                                // Recurse via TryModuleExtensions to handle
                                // "./lib" / "./lib.js" / "./lib/index.js".
                                if (TryModuleExtensions(full, out, outsz))
                                    return true;
                            }
                        }
                    }
                }
            }
        }
        // base + "/index.js"
        snprintf(candidate, sizeof candidate, "%s/index.js", base);
        if (FileExists(candidate)) {
            strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
        }
        // base + "/index.cjs"
        snprintf(candidate, sizeof candidate, "%s/index.cjs", base);
        if (FileExists(candidate)) {
            strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
        }
        // base + "/index.json" — Node's resolver tries this after .js/.cjs.
        // Some packages (spdx-license-ids, spdx-exceptions) ship only an
        // index.json with no "main" in package.json and rely on it.
        snprintf(candidate, sizeof candidate, "%s/index.json", base);
        if (FileExists(candidate)) {
            strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
        }
    }
    return false;
}

// Resolve module specifier `spec` relative to `from_dir` (absolute). Writes
// the resolved absolute path into `out` (size PATH_MAX).
//
// Resolution rules (minimal Node-compat):
//   - '/...'   absolute path; try extensions.
//   - './...' or '../...'  relative to from_dir; try extensions.
//   - bare 'foo' or 'foo/bar'  walk up from from_dir through parents,
//     looking for '<ancestor>/node_modules/<spec>', try extensions on
//     each candidate. Stop at /.
static bool ResolveModule(const char* spec, const char* from_dir,
                          char* out, size_t outsz)
{
    char base[PATH_MAX];
    if (spec[0] == '/') {
        strncpy(base, spec, sizeof base); base[sizeof base - 1] = 0;
        if (TryModuleExtensions(base, out, outsz)) {
            CanonicalizePath(out);
            return true;
        }
        return false;
    }
    if (spec[0] == '.' && (spec[1] == '/' ||
                           (spec[1] == '.' && spec[2] == '/'))) {
        snprintf(base, sizeof base, "%s/%s", from_dir, spec);
        if (TryModuleExtensions(base, out, outsz)) {
            CanonicalizePath(out);
            return true;
        }
        return false;
    }
    // Bare specifier: walk up looking in node_modules/.
    char dir[PATH_MAX];
    strncpy(dir, from_dir, sizeof dir); dir[sizeof dir - 1] = 0;
    for (;;) {
        snprintf(base, sizeof base, "%s/node_modules/%s", dir, spec);
        if (TryModuleExtensions(base, out, outsz)) {
            CanonicalizePath(out);
            return true;
        }
        // Walk up.
        if (dir[0] == 0 || (dir[0] == '/' && dir[1] == 0)) break;
        char* slash = strrchr(dir, '/');
        if (!slash) break;
        if (slash == dir) {
            // Parent is '/'.
            dir[0] = '/';
            dir[1] = 0;
        } else {
            *slash = 0;
        }
    }
    return false;
}

static bool ReadFile(const char* path, char** out, size_t* outLen) {
    FILE* f = fopen(path, "rb");
    if (!f) return false;
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return false; }
    long sz = ftell(f);
    if (sz < 0) { fclose(f); return false; }
    rewind(f);
    char* buf = (char*)malloc((size_t)sz + 1);
    if (!buf) { fclose(f); return false; }
    if (fread(buf, 1, (size_t)sz, f) != (size_t)sz) { free(buf); fclose(f); return false; }
    fclose(f);
    buf[sz] = 0;
    *out = buf;
    *outLen = (size_t)sz;
    return true;
}

static void DirnameOf(const char* path, char* out, size_t outsz) {
    const char* slash = strrchr(path, '/');
    if (!slash) { strncpy(out, ".", outsz); out[outsz - 1] = 0; return; }
    size_t n = (size_t)(slash - path);
    if (n == 0) { strncpy(out, "/", outsz); out[outsz - 1] = 0; return; }
    if (n >= outsz) n = outsz - 1;
    memcpy(out, path, n);
    out[n] = 0;
}

// Look up `path` in the global __require_cache__; return the cached module
// exports object via rval if found. If not found, sets rval to undefined.
//
// Two storage shapes coexist:
//   - File-path entries (path[0] == '/'): cache stores the MODULE object
//     ({ exports: ..., id, filename, ... }). LookupCache reads .exports
//     so circular requires see the user's reassigned module.exports
//     LIVE — matching Node's contract that cyclic requires return
//     whatever module.exports is at the moment they fire.
//   - Short-name entries ('fs', 'path', 'constants', ...): pre-populated
//     by the JS bootstrap as raw exports values. LookupCache returns them
//     as-is.
static bool LookupCache(JSContext* cx, JS::HandleObject global,
                        const char* path, JS::MutableHandleValue rval)
{
    JS::RootedValue cv(cx);
    if (!JS_GetProperty(cx, global, "__require_cache__", &cv)) return false;
    if (!cv.isObject()) { rval.setUndefined(); return true; }
    JS::RootedObject cache(cx, &cv.toObject());
    JS::RootedValue v(cx);
    if (!JS_GetProperty(cx, cache, path, &v)) return false;
    if (v.isUndefined()) { rval.setUndefined(); return true; }
    if (path[0] == '/' && v.isObject()) {
        // Module-wrapper shape — return live .exports.
        JS::RootedObject mod(cx, &v.toObject());
        JS::RootedValue exportsV(cx);
        if (!JS_GetProperty(cx, mod, "exports", &exportsV)) return false;
        rval.set(exportsV);
        return true;
    }
    rval.set(v);
    return true;
}

// Store `entry` at `path` in the global __require_cache__. For file-path
// entries the caller passes the MODULE object so that future LookupCache
// calls can read its live .exports.
static bool StoreCache(JSContext* cx, JS::HandleObject global,
                       const char* path, JS::HandleObject entry)
{
    JS::RootedValue cv(cx);
    JS::RootedObject cache(cx);
    if (!JS_GetProperty(cx, global, "__require_cache__", &cv)) return false;
    if (cv.isObject()) {
        cache = &cv.toObject();
    } else {
        cache = JS_NewPlainObject(cx);
        if (!cache) return false;
        JS::RootedValue newCv(cx, JS::ObjectValue(*cache));
        if (!JS_DefineProperty(cx, global, "__require_cache__", newCv, 0))
            return false;
    }
    JS::RootedValue ev(cx, JS::ObjectValue(*entry));
    return JS_SetProperty(cx, cache, path, ev);
}

// Compile and evaluate a JS module file as a CommonJS module. Returns the
// module.exports value via rval. Caller holds the compartment.
static bool LoadModuleFile(JSContext* cx, JS::HandleObject global,
                           const char* abs_path,
                           JS::MutableHandleValue rval)
{
    JS::RootedValue cached(cx);
    if (!LookupCache(cx, global, abs_path, &cached)) return false;
    if (!cached.isUndefined()) { rval.set(cached); return true; }

    char* src = nullptr;
    size_t srcLen = 0;
    if (!ReadFile(abs_path, &src, &srcLen)) {
        JS_ReportError(cx, "require: cannot read %s: %s", abs_path, strerror(errno));
        return false;
    }

    // JSON modules: if the path ends in .json, parse and return the value
    // directly. No wrapping, no caching-as-exports subtleties — Node does
    // this too.
    size_t alen = strlen(abs_path);
    if (alen >= 5 &&
        abs_path[alen - 5] == '.' &&
        abs_path[alen - 4] == 'j' &&
        abs_path[alen - 3] == 's' &&
        abs_path[alen - 2] == 'o' &&
        abs_path[alen - 1] == 'n') {
        size_t u16len = 0;
        JS::UTF8Chars u8((const char*)src, srcLen);
        char16_t* u16 = JS::UTF8CharsToNewTwoByteCharsZ(cx, u8, &u16len).get();
        free(src);
        if (!u16) return false;
        JS::RootedValue parsed(cx);
        bool ok = JS_ParseJSON(cx, u16, (uint32_t)u16len, &parsed);
        free(u16);
        if (!ok) return false;
        // Wrap the parsed value in a synthetic module ({exports: parsed})
        // so the cache always holds module-shape objects for file-path
        // keys. Lets LookupCache consistently read .exports.
        JS::RootedObject modStub(cx, JS_NewPlainObject(cx));
        if (!modStub) return false;
        if (!JS_DefineProperty(cx, modStub, "exports", parsed, JSPROP_ENUMERATE))
            return false;
        if (!StoreCache(cx, global, abs_path, modStub)) return false;
        rval.set(parsed);
        return true;
    }

    // Strip a leading UNIX shebang line so scripts can start with
    // `#!/usr/bin/env node`. Replace the shebang with spaces (not remove)
    // so that line/column numbers in error messages stay aligned with the
    // source file.
    if (srcLen >= 2 && src[0] == '#' && src[1] == '!') {
        size_t i = 0;
        while (i < srcLen && src[i] != '\n') { src[i] = ' '; ++i; }
    }

    // Wrap in a function so local `var`s are scoped and `module`/`exports`/
    // `require`/`__filename`/`__dirname` are real parameters.
    // The leading newline keeps line numbers in errors aligned.
    // Removing the trailing ';' leaves the wrapped source as a bare
    // ExpressionStatement whose completion value is the function expression
    // itself — which JS::Evaluate then returns via `wrapped`.
    static const char kPrefix[] =
        "(function (exports, require, module, __filename, __dirname) {\n";
    static const char kSuffix[] = "\n})";

    JS::CompileOptions opts(cx);
    opts.setFileAndLine(abs_path, 0);

    // Closure: wrap (prefix+body+suffix), UTF-8 → UTF-16, Evaluate.
    // Returns true + fills `wrapped` on success; otherwise leaves pending
    // exception on cx and returns false.
    auto wrapAndEval = [&](const char* body, size_t bodyLen,
                           JS::MutableHandleValue wrapped) -> bool {
        size_t wlen = sizeof(kPrefix) - 1 + bodyLen + sizeof(kSuffix) - 1;
        char* wsrc = (char*)malloc(wlen + 1);
        if (!wsrc) return false;
        memcpy(wsrc, kPrefix, sizeof(kPrefix) - 1);
        memcpy(wsrc + sizeof(kPrefix) - 1, body, bodyLen);
        memcpy(wsrc + sizeof(kPrefix) - 1 + bodyLen,
               kSuffix, sizeof(kSuffix) - 1);
        wsrc[wlen] = 0;

        size_t u16len = 0;
        JS::UTF8Chars u8((const char*)wsrc, wlen);
        char16_t* u16 = JS::UTF8CharsToNewTwoByteCharsZ(cx, u8, &u16len).get();
        free(wsrc);
        if (!u16) return false;

        bool ev = JS::Evaluate(cx, opts, u16, u16len, wrapped);
        free(u16);
        return ev;
    };

    JS::RootedValue wrapped(cx);
    bool ok = wrapAndEval(src, srcLen, &wrapped);

    // Parse-failure fallback: if the wrapped source didn't parse (pending
    // SyntaxError), ask JS-side __try_babel_transpile__ for a lowered ES5
    // version and re-evaluate that. Opt-out via IONPOWER_NO_BABEL=1.
    if (!ok) {
        JS::RootedValue savedExc(cx, JS::UndefinedValue());
        bool hadExc = JS_GetPendingException(cx, &savedExc);
        JS_ClearPendingException(cx);

        JS::RootedValue hookV(cx);
        if (JS_GetProperty(cx, global, "__try_babel_transpile__", &hookV)
            && hookV.isObject() && JS_ObjectIsFunction(cx, &hookV.toObject())) {
            // mtime in ms (same units as fs.statSync).
            struct stat st;
            double mtimeMs = 0.0;
            if (stat(abs_path, &st) == 0)
                mtimeMs = (double)st.st_mtime * 1000.0;

            JS::RootedString pathS(cx, JS_NewStringCopyZ(cx, abs_path));
            // Feed raw UTF-8 bytes through UTF-16 so non-ASCII survives.
            size_t rawU16len = 0;
            JS::UTF8Chars rawU8((const char*)src, srcLen);
            char16_t* rawU16 =
                JS::UTF8CharsToNewTwoByteCharsZ(cx, rawU8, &rawU16len).get();
            JS::RootedString srcS(cx,
                rawU16 ? JS_NewUCString(cx, rawU16, rawU16len) : nullptr);
            if (!pathS || !srcS) {
                // Can't even build args — restore original exception.
                if (hadExc && !JS_IsExceptionPending(cx))
                    JS_SetPendingException(cx, savedExc);
                free(src);
                return false;
            }

            JS::AutoValueArray<3> tArgs(cx);
            tArgs[0].setString(pathS);
            tArgs[1].setString(srcS);
            tArgs[2].setNumber(mtimeMs);
            JS::RootedValue tOut(cx);
            bool called = JS::Call(cx, JS::UndefinedHandleValue, hookV,
                                   tArgs, &tOut);
            if (called && tOut.isString()) {
                // Re-evaluate with transpiled body.
                JS::RootedString outS(cx, tOut.toString());
                JSAutoByteString outBytes;
                if (outBytes.encodeUtf8(cx, outS)) {
                    const char* outRaw = outBytes.ptr();
                    size_t outLen = strlen(outRaw);
                    ok = wrapAndEval(outRaw, outLen, &wrapped);
                }
            } else if (!called) {
                // Hook itself threw. Drop that; restore original.
                JS_ClearPendingException(cx);
            }
        }

        if (!ok) {
            // No transpile or transpiled code still didn't parse.
            // Restore the original exception (babel wasn't able to help).
            if (hadExc && !JS_IsExceptionPending(cx))
                JS_SetPendingException(cx, savedExc);
            free(src);
            return false;
        }
    }

    free(src);
    if (!wrapped.isObject() || !JS_ObjectIsFunction(cx, &wrapped.toObject())) {
        JS_ReportError(cx, "require: wrapper did not evaluate to a function");
        return false;
    }

    // Set up module, exports, local require function.
    JS::RootedObject module(cx, JS_NewPlainObject(cx));
    if (!module) return false;
    JS::RootedObject exports(cx, JS_NewPlainObject(cx));
    if (!exports) return false;
    JS::RootedValue expv(cx, JS::ObjectValue(*exports));
    if (!JS_DefineProperty(cx, module, "exports", expv, JSPROP_ENUMERATE))
        return false;

    // Bind this module into the cache EARLY so circular requires resolve.
    // We store the MODULE wrapper (not the exports object) so the cache
    // sees user-side `module.exports = X` reassignments through .exports
    // — matching Node's contract.
    if (!StoreCache(cx, global, abs_path, module)) return false;

    // Build a require() function bound to this module's directory.
    char dir[PATH_MAX];
    DirnameOf(abs_path, dir, sizeof dir);
    JS::RootedString dirS(cx, JS_NewStringCopyZ(cx, dir));
    if (!dirS) return false;
    JS::RootedString fileS(cx, JS_NewStringCopyZ(cx, abs_path));
    if (!fileS) return false;

    // Fetch the global RequireForDir factory (installed by InstallRequire)
    // and call it with the directory to produce a bound require.
    JS::RootedValue makeReqV(cx);
    if (!JS_GetProperty(cx, global, "__make_require__", &makeReqV)) return false;
    if (!makeReqV.isObject() || !JS_ObjectIsFunction(cx, &makeReqV.toObject())) {
        JS_ReportError(cx, "require: internal __make_require__ missing");
        return false;
    }
    JS::AutoValueArray<1> mrArgs(cx);
    mrArgs[0].setString(dirS);
    JS::RootedValue boundReqV(cx);
    if (!JS::Call(cx, JS::UndefinedHandleValue, makeReqV, mrArgs, &boundReqV))
        return false;

    // Invoke wrapper(exports, require, module, __filename, __dirname).
    JS::AutoValueArray<5> callArgs(cx);
    callArgs[0].setObject(*exports);
    callArgs[1].set(boundReqV);
    callArgs[2].setObject(*module);
    callArgs[3].setString(fileS);
    callArgs[4].setString(dirS);

    JS::RootedValue wrapThisV(cx, JS::UndefinedValue());
    JS::RootedValue discard(cx);
    if (!JS::Call(cx, wrapThisV, wrapped, callArgs, &discard))
        return false;

    // Read module.exports back (user may have reassigned it). The cache
    // already holds the module wrapper, so .exports is naturally live
    // for any subsequent require() — no extra StoreCache needed.
    JS::RootedValue finalExp(cx);
    if (!JS_GetProperty(cx, module, "exports", &finalExp)) return false;
    rval.set(finalExp);
    return true;
}

// JS-callable: __resolve_native__(absDir, specifier) -> absolute path string.
// Same resolver as RequireNative, but skips the load step. Exposed so JS
// can implement Module._resolveFilename without loading the file as a
// side-effect. Throws "MODULE_NOT_FOUND" (a JS Error with .code) on miss
// — JS-side wraps this in the proper Node error shape.
static bool ResolveNative(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "resolve: internal arity");
        return false;
    }
    JS::RootedString dirS(cx, JS::ToString(cx, args[0]));
    JS::RootedString specS(cx, JS::ToString(cx, args[1]));
    if (!dirS || !specS) return false;

    JSAutoByteString dirB(cx, dirS), specB(cx, specS);
    if (!dirB || !specB) return false;

    char abs[PATH_MAX];
    if (!ResolveModule(specB.ptr(), dirB.ptr(), abs, sizeof abs)) {
        JS_ReportError(cx, "MODULE_NOT_FOUND: cannot find module '%s' from '%s'",
                       specB.ptr(), dirB.ptr());
        return false;
    }
    JS::RootedString outS(cx, JS_NewStringCopyZ(cx, abs));
    if (!outS) return false;
    args.rval().setString(outS);
    return true;
}

// JS-callable: __require_native__(absDir, specifier) -> exports.
static bool RequireNative(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 2) {
        JS_ReportError(cx, "require: internal arity");
        return false;
    }
    JS::RootedString dirS(cx, JS::ToString(cx, args[0]));
    JS::RootedString specS(cx, JS::ToString(cx, args[1]));
    if (!dirS || !specS) return false;

    JSAutoByteString dirB(cx, dirS), specB(cx, specS);
    if (!dirB || !specB) return false;

    char abs[PATH_MAX];
    if (!ResolveModule(specB.ptr(), dirB.ptr(), abs, sizeof abs)) {
        JS_ReportError(cx, "require: cannot find module '%s' from '%s'",
                       specB.ptr(), dirB.ptr());
        return false;
    }

    JS::RootedObject global(cx, JS::CurrentGlobalOrNull(cx));
    if (!global) return false;

    JS::RootedValue out(cx);
    if (!LoadModuleFile(cx, global, abs, &out)) return false;
    args.rval().set(out);
    return true;
}

// Installs:
//   __require_native__(dir, spec)  -- C++ entry point
//   __make_require__(dir)         -- returns a bound require(spec) closure
//   __require_cache__             -- persistent cache object
// The top-level require is bound to process.cwd() by the entry-script runner.
bool InstallRequire(JSContext* cx, JS::HandleObject global) {
    if (!JS_DefineFunction(cx, global, "__require_native__",
                           RequireNative, 2,
                           JSPROP_PERMANENT | JSPROP_READONLY))
        return false;
    if (!JS_DefineFunction(cx, global, "__resolve_native__",
                           ResolveNative, 2,
                           JSPROP_PERMANENT | JSPROP_READONLY))
        return false;

    JS::RootedObject cache(cx, JS_NewPlainObject(cx));
    if (!cache) return false;
    JS::RootedValue cv(cx, JS::ObjectValue(*cache));
    if (!JS_DefineProperty(cx, global, "__require_cache__", cv, 0))
        return false;

    // Install the JS-level factory: __make_require__(dir) => require(spec).
    // We compile the JS inline so no external file is needed.
    static const char kFactorySrc[] =
        "function __make_require__(dir) {\n"
        "  var f = function (spec) { return __require_native__(dir, spec); };\n"
        "  f.resolve = function (spec) { return dir + '/' + spec; };\n"
        "  return f;\n"
        "}\n";
    JS::CompileOptions opts(cx);
    opts.setFileAndLine("<ionpower-node internal>", 1);
    JS::RootedValue discard(cx);
    if (!JS::Evaluate(cx, opts, kFactorySrc, sizeof(kFactorySrc) - 1, &discard))
        return false;
    return true;
}

// Public helper: compile/run the entry script as a CommonJS module, bound
// to its own directory. Exposed via globals.h for main.cpp.
bool RunEntryScript(JSContext* cx, JS::HandleObject global, const char* path) {
    char abs[PATH_MAX];
    if (path[0] == '/') {
        strncpy(abs, path, sizeof abs); abs[sizeof abs - 1] = 0;
    } else {
        char cwd[PATH_MAX];
        if (!getcwd(cwd, sizeof cwd)) {
            JS_ReportError(cx, "entry: getcwd failed");
            return false;
        }
        snprintf(abs, sizeof abs, "%s/%s", cwd, path);
    }
    if (!FileExists(abs)) {
        JS_ReportError(cx, "entry: file not found: %s", abs);
        return false;
    }
    JS::RootedValue exports(cx);
    return LoadModuleFile(cx, global, abs, &exports);
}

} // namespace ionpower
