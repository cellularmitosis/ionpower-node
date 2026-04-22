// Install all Node-compat subsystems onto the global and wire up
// the require() chain so that the entry script runs as a CommonJS module.
//
// Installation order:
//   1. console.
//   2. process.
//   3. fs (native binding as __fs_native__).
//   4. path (native binding as __path_native__).
//   5. Buffer.
//   6. require machinery (__require_native__, __make_require__,
//      __require_cache__).
//   7. A tiny JS shim that builds the public `fs`, `path` modules
//      by wrapping the native bindings — this is where we can grow
//      higher-level APIs without touching C++.

#include "node_compat/globals.h"

#include <stdio.h>

#include "jsapi.h"

namespace ionpower {

static const char kBootstrapJS[] =
    // Public fs API is the native binding directly; any future higher-level
    // wrapping happens here.
    "(function () {\n"
    "  var nativeFs = __fs_native__;\n"
    "  var fs = {\n"
    "    readFileSync: nativeFs.readFileSync,\n"
    "    writeFileSync: nativeFs.writeFileSync,\n"
    "    existsSync: nativeFs.existsSync,\n"
    "    readdirSync: nativeFs.readdirSync,\n"
    "    statSync: nativeFs.statSync,\n"
    "    unlinkSync: nativeFs.unlinkSync\n"
    "  };\n"
    "  var path = {\n"
    "    join: __path_native__.join,\n"
    "    dirname: __path_native__.dirname,\n"
    "    basename: __path_native__.basename,\n"
    "    extname: __path_native__.extname,\n"
    "    resolve: __path_native__.resolve,\n"
    "    isAbsolute: __path_native__.isAbsolute,\n"
    "    sep: __path_native__.sep\n"
    "  };\n"
    // Register these as 'core modules' in the require cache so user code
    // can `require('fs')` / `require('path')`. We key them on bare names
    // that ResolveModule will never produce (it only produces abs paths),
    // which means the C++ side won't accidentally collide. We handle the
    // short-circuit by monkeypatching require via the factory.
    "  __require_cache__['fs'] = fs;\n"
    "  __require_cache__['path'] = path;\n"
    // Re-wrap __make_require__ so bare specifiers check the cache first.
    "  var origMake = __make_require__;\n"
    "  __make_require__ = function(dir) {\n"
    "    var req = origMake(dir);\n"
    "    return function(spec) {\n"
    "      if (__require_cache__.hasOwnProperty(spec)) return __require_cache__[spec];\n"
    "      return req(spec);\n"
    "    };\n"
    "  };\n"
    "})();\n";

bool InstallNodeCompatGlobals(JSContext* cx, JS::HandleObject global,
                              int argc, char** argv)
{
    if (!InstallConsole(cx, global))       { fprintf(stderr, "InstallConsole failed\n"); return false; }
    if (!InstallProcess(cx, global, argc, argv))
                                           { fprintf(stderr, "InstallProcess failed\n"); return false; }
    if (!InstallFsSync(cx, global))        { fprintf(stderr, "InstallFs failed\n"); return false; }
    if (!InstallPath(cx, global))          { fprintf(stderr, "InstallPath failed\n"); return false; }
    if (!InstallBuffer(cx, global))        { fprintf(stderr, "InstallBuffer failed\n"); return false; }
    if (!InstallRequire(cx, global))       { fprintf(stderr, "InstallRequire failed\n"); return false; }
    if (!InstallTimers(cx, global))        { fprintf(stderr, "InstallTimers failed\n"); return false; }

    JS::CompileOptions opts(cx);
    opts.setFileAndLine("<ionpower-node bootstrap>", 1);
    JS::RootedValue discard(cx);
    if (!JS::Evaluate(cx, opts, kBootstrapJS, sizeof(kBootstrapJS) - 1, &discard)) {
        fprintf(stderr, "bootstrap evaluate failed\n");
        return false;
    }
    return true;
}

} // namespace ionpower
