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

static bool DirExists(const char* path) {
    struct stat st;
    return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
}

// Resolve module specifier `spec` relative to `from_dir` (absolute). Writes
// the resolved absolute path into `out` (size PATH_MAX).
static bool ResolveModule(const char* spec, const char* from_dir,
                          char* out, size_t outsz)
{
    char base[PATH_MAX];
    if (spec[0] == '/') {
        // absolute
        strncpy(base, spec, sizeof base); base[sizeof base - 1] = 0;
    } else {
        // Only './foo' and '../foo' are supported. Bare specs unsupported.
        if (!(spec[0] == '.' && (spec[1] == '/' || (spec[1] == '.' && spec[2] == '/')))) {
            return false;
        }
        snprintf(base, sizeof base, "%s/%s", from_dir, spec);
    }
    // Try: base, base+".js", base+"/index.js".
    if (FileExists(base)) {
        strncpy(out, base, outsz); out[outsz - 1] = 0; return true;
    }
    char candidate[PATH_MAX];
    snprintf(candidate, sizeof candidate, "%s.js", base);
    if (FileExists(candidate)) {
        strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
    }
    if (DirExists(base)) {
        snprintf(candidate, sizeof candidate, "%s/index.js", base);
        if (FileExists(candidate)) {
            strncpy(out, candidate, outsz); out[outsz - 1] = 0; return true;
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
static bool LookupCache(JSContext* cx, JS::HandleObject global,
                        const char* path, JS::MutableHandleValue rval)
{
    JS::RootedValue cv(cx);
    if (!JS_GetProperty(cx, global, "__require_cache__", &cv)) return false;
    if (!cv.isObject()) { rval.setUndefined(); return true; }
    JS::RootedObject cache(cx, &cv.toObject());
    JS::RootedValue v(cx);
    if (!JS_GetProperty(cx, cache, path, &v)) return false;
    rval.set(v);
    return true;
}

static bool StoreCache(JSContext* cx, JS::HandleObject global,
                       const char* path, JS::HandleObject exports)
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
    JS::RootedValue ev(cx, JS::ObjectValue(*exports));
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

    // Wrap in a function so local `var`s are scoped and `module`/`exports`/
    // `require`/`__filename`/`__dirname` are real parameters.
    // The leading newline keeps line numbers in errors aligned.
    // Removing the trailing ';' leaves the wrapped source as a bare
    // ExpressionStatement whose completion value is the function expression
    // itself — which JS::Evaluate then returns via `wrapped`. Leaving the ';'
    // on would *still* evaluate to the function (ExpressionStatement
    // completion rule), but the no-semicolon form is one less spec lookup
    // for a future reader.
    static const char kPrefix[] =
        "(function (exports, require, module, __filename, __dirname) {\n";
    static const char kSuffix[] = "\n})";
    size_t wlen = sizeof(kPrefix) - 1 + srcLen + sizeof(kSuffix) - 1;
    char* wsrc = (char*)malloc(wlen + 1);
    if (!wsrc) { free(src); return false; }
    memcpy(wsrc, kPrefix, sizeof(kPrefix) - 1);
    memcpy(wsrc + sizeof(kPrefix) - 1, src, srcLen);
    memcpy(wsrc + sizeof(kPrefix) - 1 + srcLen, kSuffix, sizeof(kSuffix) - 1);
    wsrc[wlen] = 0;
    free(src);

    JS::CompileOptions opts(cx);
    opts.setFileAndLine(abs_path, 0);

    JS::RootedValue wrapped(cx);
    bool ok = JS::Evaluate(cx, opts, wsrc, wlen, &wrapped);
    free(wsrc);
    if (!ok) return false;
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

    // Bind this module into the cache EARLY so circular requires get a
    // partial exports object, matching Node semantics.
    if (!StoreCache(cx, global, abs_path, exports)) return false;

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

    // Read module.exports back (user may have reassigned it).
    JS::RootedValue finalExp(cx);
    if (!JS_GetProperty(cx, module, "exports", &finalExp)) return false;
    // Update the cache with the final value in case user reassigned.
    if (finalExp.isObject()) {
        JS::RootedObject finalExpObj(cx, &finalExp.toObject());
        if (!StoreCache(cx, global, abs_path, finalExpObj)) return false;
    }
    rval.set(finalExp);
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
