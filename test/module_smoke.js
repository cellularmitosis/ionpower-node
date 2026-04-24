// module.createRequire + module.builtinModules smoke.
//
// The 'module' core module is what Node 12+ dual-mode (ESM + CJS)
// packages reach for when they need a require() rooted at a specific
// file's location. We support the minimal shape.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- Core shape ---
var mod = require("module");
assert(typeof mod.createRequire === "function", "module.createRequire is a function");
assert(Array.isArray(mod.builtinModules), "module.builtinModules is an array");
assert(mod.builtinModules.indexOf("fs") >= 0, "builtinModules includes 'fs'");
assert(mod.builtinModules.indexOf("path") >= 0, "builtinModules includes 'path'");
assert(mod.builtinModules.indexOf("module") >= 0, "builtinModules includes 'module'");
console.log("ok: module core surface");

// --- createRequire(filename) from an absolute path ---
var localRequire = mod.createRequire(__filename);
assert(typeof localRequire === "function", "createRequire returns a function");

// Load a core module through the bound require.
var fs = localRequire("fs");
assert(typeof fs.readFileSync === "function", "bound require loads core 'fs'");
console.log("ok: createRequire loads core module");

// Load a relative path — should resolve relative to __filename's dir.
// Use one of our own vendored libs.
var crc = localRequire("./vendor/crc32.js");
assert(crc, "bound require loads vendored lib");
// crc32 may be a function or an object exposing .str, depending on how
// the vendored module.exports was set — any of those means we loaded it.
var ok = typeof crc === "function" || typeof crc === "object";
assert(ok, "vendored lib loaded (type=" + typeof crc + ")");
console.log("ok: createRequire loads relative path");

// --- createRequire(file://...) — file URL string ---
var url = "file://" + __filename;
var fromURL = mod.createRequire(url);
assert(typeof fromURL === "function", "createRequire from file:// URL");
var path2 = fromURL("path");
assert(typeof path2.join === "function", "file:// createRequire loads path core");
console.log("ok: createRequire accepts file:// URL");

// --- .resolve() is present on the returned require ---
var resolved = localRequire.resolve("./vendor/crc32.js");
assert(typeof resolved === "string" && resolved.length > 0, "resolve returns a string");
console.log("ok: require.resolve");

console.log("\nmodule smoke: all assertions passed");
