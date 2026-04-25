// module.Module class smoke (v0.69).

var mod = require("module");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- Module constructor ----
assert(typeof mod.Module === "function", "module.Module is a function");

var m = new mod.Module("/some/id", null);
assert(m.id === "/some/id", "Module.id");
assert(m.exports && typeof m.exports === "object", "Module.exports defaulted to {}");
assert(m.loaded === false, "Module.loaded false");
assert(Array.isArray(m.children) && m.children.length === 0, "Module.children");
console.log("ok: new Module(id, parent)");

// ---- Module.wrap ----
assert(typeof mod.Module.wrap === "function", "Module.wrap is a function");
var wrapped = mod.Module.wrap("module.exports = 42;");
assert(wrapped.indexOf("(function (exports, require, module, __filename, __dirname) {") === 0,
       "wrap prefix: " + wrapped.slice(0, 60));
assert(wrapped.indexOf("module.exports = 42;") > 0, "wrap embeds source");
assert(wrapped.indexOf("\n});") === wrapped.length - 4, "wrap suffix");
console.log("ok: Module.wrap");

// ---- Module.wrapper exposed for libraries that splice manually ----
assert(Array.isArray(mod.Module.wrapper) && mod.Module.wrapper.length === 2, "wrapper is [prefix, suffix]");
console.log("ok: Module.wrapper");

// ---- Module._cache mirrors __require_cache__ ----
assert(mod.Module._cache && typeof mod.Module._cache === "object", "_cache is an object");
assert(mod.Module._cache.fs === require("fs"), "_cache['fs'] === require('fs')");
console.log("ok: Module._cache shared with require cache");

// ---- Module.builtinModules / isBuiltin / createRequire ----
assert(Array.isArray(mod.Module.builtinModules), "builtinModules array");
assert(mod.Module.builtinModules.indexOf("fs") >= 0, "fs in builtinModules");
assert(mod.Module.isBuiltin("fs") === true, "isBuiltin fs");
assert(mod.Module.isBuiltin("node:path") === true, "isBuiltin node:path");
assert(mod.Module.isBuiltin("not-a-builtin") === false, "isBuiltin returns false for others");
console.log("ok: Module static helpers");

assert(typeof mod.Module.createRequire === "function", "Module.createRequire is fn");
var r = mod.Module.createRequire(__filename || "/tmp/x.js");
assert(typeof r === "function", "createRequire returns require fn");
assert(typeof r("fs") === "object", "produced require can resolve fs");
console.log("ok: Module.createRequire produces working require");

// ---- Module._extensions present (mostly cosmetic) ----
assert(mod.Module._extensions && ".js" in mod.Module._extensions, "_extensions has .js");
console.log("ok: Module._extensions");

console.log("\nmodule_class smoke: all assertions passed");
