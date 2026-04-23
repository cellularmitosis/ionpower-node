// uniqid: short unique ID generator (timestamp + counter based).

var uniqid = require("./vendor/uniqid.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var id = uniqid();
assert(typeof id === "string" && id.length > 0, "uniqid returns non-empty string");

// Two consecutive IDs should differ.
var id1 = uniqid();
var id2 = uniqid();
assert(id1 !== id2, "consecutive IDs differ");
console.log("ok: uniqid basic uniqueness");

// With prefix.
var pid = uniqid("myapp-");
assert(pid.indexOf("myapp-") === 0, "prefix applied: " + pid);
console.log("ok: uniqid with prefix");

// Batch uniqueness check.
var seen = {};
for (var i = 0; i < 1000; ++i) {
    var x = uniqid();
    if (seen[x]) { console.error("FAIL: duplicate in 1000-batch"); process.exit(1); }
    seen[x] = true;
}
console.log("ok: uniqid 1000 unique in a row");

console.log("\nuniqid smoke: all assertions passed");
