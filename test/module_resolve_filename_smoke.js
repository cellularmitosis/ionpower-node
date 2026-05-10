// Module._resolveFilename(spec, parent) (Node 10 parity, pass 2).
//
// Surfaced by the npm 6.14.18 install pipeline: resolve-from calls
// Module._resolveFilename(spec, fakeParent) to get an absolute path
// without loading the file. Pre-v0.88 we had a Module class but no
// _resolveFilename method; npm threw in lib/install.js → npm-lifecycle
// → resolve-from at module load time.

var Module = require("module");
var path   = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Two access shapes — same convention as _nodeModulePaths in pass 1.
// resolve-from uses the wrapper-object shape (require('module')._resolveFilename).
assert(typeof Module._resolveFilename === "function",
       "require('module')._resolveFilename is function (wrapper shape)");
assert(typeof Module.Module._resolveFilename === "function",
       "Module.Module._resolveFilename is function (class shape)");

// 1. Relative spec from a known directory (parent = this module).
//    Mirrors how a module would resolve a sibling: spec './path' relative
//    to the parent's filename.
var fakeParent = { filename: __filename };
var resolved = Module._resolveFilename("./vendor/abbrev.js", fakeParent);
assert(typeof resolved === "string", "returns a string");
assert(resolved.indexOf("/vendor/abbrev.js") >= 0,
       "relative spec resolves under vendor/: " + resolved);
console.log("ok: relative spec ->", resolved);

// 2. Bare spec resolved via node_modules-style lookup. The fixture
//    test/vendor/index_json_pkg has no "main" but has index.json.
//    We use a synthetic parent whose filename lives under
//    test/vendor/index_json_pkg/ — its node_modules walk should find
//    the package itself when given its name.
//
//    (We don't have a true `node_modules/foo` layout in the test tree,
//    so use the relative spec form to exercise the bare-vs-relative
//    branch in __resolve_native__.)
var resolvedJson = Module._resolveFilename("./vendor/index_json_pkg",
                                           fakeParent);
assert(/index\.json$/.test(resolvedJson),
       "package with index.json + no main resolves to index.json");
console.log("ok: index_json_pkg ->", resolvedJson);

// 3. node: prefix stripped (Node 12+ contract; we adopt for parity).
//    'node:path' should resolve identically to 'path' for built-ins —
//    but we don't have built-ins on the resolver path here, so test the
//    prefix-stripping branch indirectly: passing 'node:./vendor/abbrev.js'
//    is contrived but valid input shape and exercises the strip.
var stripped = Module._resolveFilename("node:./vendor/abbrev.js", fakeParent);
assert(stripped.indexOf("/vendor/abbrev.js") >= 0,
       "node: prefix stripped before resolve");
console.log("ok: node: prefix stripped");

// 4. MODULE_NOT_FOUND error shape on miss.
var threw = false;
try {
    Module._resolveFilename("./this-does-not-exist-anywhere", fakeParent);
} catch (e) {
    threw = true;
    assert(e instanceof Error, "throws an Error instance");
    assert(e.code === "MODULE_NOT_FOUND",
           "error has .code === 'MODULE_NOT_FOUND' (got " + e.code + ")");
    assert(/Cannot find module/.test(e.message),
           "error message mentions 'Cannot find module' (got " + e.message + ")");
}
assert(threw, "missing module throws");
console.log("ok: MODULE_NOT_FOUND error shape");

// 5. Parent without .filename falls back to process.cwd().
//    We use a relative spec that resolves under cwd to verify this works
//    without throwing. We don't assert the exact path because cwd varies
//    by how the test is run.
var cwd = process.cwd();
// The test/ directory is a sibling of vendor/ when run from repo root.
// When run from elsewhere it may not be — so just verify the function
// accepts a null parent and either resolves or throws MODULE_NOT_FOUND.
var sawResult = false, sawNotFound = false;
try {
    var r = Module._resolveFilename("./test/module_resolve_filename_smoke.js", null);
    sawResult = (typeof r === "string");
} catch (e) {
    sawNotFound = (e.code === "MODULE_NOT_FOUND");
}
assert(sawResult || sawNotFound,
       "null parent: either resolves or throws MODULE_NOT_FOUND (cwd was " + cwd + ")");
console.log("ok: null parent handled");

console.log("\nmodule._resolveFilename smoke: all assertions passed");
