// hashids: obfuscated short IDs. The vendored UMD binds to `self`
// (browser global); the bootstrap aliases that to the runtime global.

var Hashids = require("./vendor/hashids.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var h = new Hashids("salt-42", 8);
var id = h.encode(1);
assert(typeof id === "string" && id.length >= 8, "encode produced id len >= 8: " + id);
console.log("ok: encoded 1 ->", id);

var back = h.decode(id);
assert(back.length === 1 && back[0] === 1, "decoded " + id + ": " + JSON.stringify(back));
console.log("ok: decoded back to 1");

// Multiple.
var multi = h.encode([1, 2, 3, 100]);
var backMulti = h.decode(multi);
assert(backMulti.length === 4 &&
       backMulti[0] === 1 && backMulti[3] === 100,
       "multi roundtrip: " + JSON.stringify(backMulti));
console.log("ok: multi roundtrip:", multi);

// Different salt = different output.
var h2 = new Hashids("other-salt", 8);
assert(h2.encode(1) !== h.encode(1), "salt changes output");
console.log("ok: salt sensitivity");

console.log("\nhashids smoke: all assertions passed");
