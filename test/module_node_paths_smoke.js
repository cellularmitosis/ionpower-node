// Module._nodeModulePaths(from) (Node 10 parity, pass 1).
//
// Surfaced by the npm 6.14.18 install pipeline: resolve-from calls
// Module._nodeModulePaths to discover node_modules locations to search.
// Pre-v0.87 we had a Module class but no _nodeModulePaths method; npm
// threw at lib/install.js → resolve-from.

var Module = require("module");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Two access shapes — real Node returns the Module class itself from
// require('module'), so callers do require('module')._nodeModulePaths.
// Our shim returns a wrapper object with `.Module` for the class. Both
// shapes need the method (resolve-from uses the wrapper-object shape).
assert(typeof Module._nodeModulePaths === "function",
       "require('module')._nodeModulePaths is function (wrapper shape)");
assert(typeof Module.Module._nodeModulePaths === "function",
       "Module.Module._nodeModulePaths is function (class shape)");
// Make local Module point at the wrapper for the rest of the test, since
// that's the npm-actually-uses path.

// Standard ancestor walk: every parent dir + /node_modules.
var paths = Module._nodeModulePaths("/a/b/c");
assert(Array.isArray(paths), "returns array");
assert(paths.indexOf("/a/b/c/node_modules") >= 0, "includes self/node_modules");
assert(paths.indexOf("/a/b/node_modules") >= 0,   "includes parent/node_modules");
assert(paths.indexOf("/a/node_modules") >= 0,     "includes grandparent/node_modules");
assert(paths.indexOf("/node_modules") >= 0,       "includes root /node_modules");
console.log("ok: _nodeModulePaths('/a/b/c') ->", JSON.stringify(paths));

// Trailing slash: should not produce a duplicate.
var paths2 = Module._nodeModulePaths("/a/b/c/");
assert(paths2.indexOf("/a/b/c/node_modules") >= 0,
       "trailing slash still resolves correctly");
assert(paths2.indexOf("/a/b/c//node_modules") < 0,
       "no double-slash variants");
console.log("ok: trailing slash handled");

// From inside node_modules: don't repeat node_modules/node_modules.
var paths3 = Module._nodeModulePaths("/x/y/node_modules");
assert(paths3.indexOf("/x/y/node_modules/node_modules") < 0,
       "ancestor-named-node_modules is NOT itself recursed into");
console.log("ok: from-inside-node_modules sane");

// Root.
var paths4 = Module._nodeModulePaths("/");
assert(paths4.indexOf("/node_modules") >= 0, "root yields /node_modules");
console.log("ok: from root");

console.log("\nmodule._nodeModulePaths smoke: all assertions passed");
