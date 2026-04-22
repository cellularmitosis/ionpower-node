// Smoke test: ini (Windows-style ini parser) on ionpower-node.
var ini = require("./vendor/ini.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var text = [
    "; top-level comment",
    "name = ionpower-node",
    "debug = true",
    "",
    "[build]",
    "cc = gcc-4.9",
    "optim = -O2",
    "",
    "[target.G5]",
    "cpu = 970",
    "tested = yes",
    "",
    "[target.G3]",
    "cpu = 750",
    "tested = no",
].join("\n");

var obj = ini.parse(text);
console.log("parsed:", JSON.stringify(obj, null, 2));
assert(obj.name === "ionpower-node",       "top-level name");
assert(obj.build.cc === "gcc-4.9",          "section key");
assert(obj.target.G5.cpu === "970",         "nested section");
assert(obj.target.G5.tested === "yes",      "nested value");
console.log("ok: parse");

// round-trip
var out = ini.stringify(obj);
console.log("re-stringified:\n" + out);
assert(out.indexOf("[build]") >= 0,   "round-trip has section");
assert(out.indexOf("cc=gcc-4.9") >= 0 || out.indexOf("cc = gcc-4.9") >= 0,
       "round-trip has key");

console.log("\nini smoke: all assertions passed");
