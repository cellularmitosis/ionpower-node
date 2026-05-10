// require() resolution to <dir>/index.json (Node 10 parity, pass 1).
//
// Real Node tries <base>/index.{js,json,node} when there is no "main"
// in package.json. Pre-v0.87 we missed the .json case, so packages
// shaped like spdx-license-ids (index.json only) failed to resolve
// during the npm 6.14.18 bring-up.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Direct path: <dir>/index.json. The require resolver should pick it up
// without an explicit /index.json suffix.
var pkg = require("./vendor/index_json_pkg");
assert(Array.isArray(pkg),
       "package resolved to its index.json (array), got: " +
       JSON.stringify(pkg));
assert(pkg.length === 3 && pkg[0] === "MIT",
       "index.json content matches expected fixture");
console.log("ok: require('./vendor/index_json_pkg') -> index.json");

// Calling again returns the cached value (object identity for object
// types; JSON arrays are objects).
var again = require("./vendor/index_json_pkg");
assert(again === pkg, "same module object on repeat require");
console.log("ok: require cache hit on second call");

console.log("\nindex.json resolve smoke: all assertions passed");
