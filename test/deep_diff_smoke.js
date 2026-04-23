// deep-diff: compute a patch between two objects.

var DeepDiff = require("./vendor/deep-diff.js");
var diff = DeepDiff.diff || DeepDiff;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var a = { name: "alice", age: 30, tags: ["admin"] };
var b = { name: "alice", age: 31, tags: ["admin", "owner"] };

var d = diff(a, b);
assert(Array.isArray(d), "diff is array");
assert(d.length >= 2, "at least 2 diffs (age edit + tags array add)");

// Types: 'E' edit, 'N' new, 'D' delete, 'A' array.
var kinds = d.map(function (x) { return x.kind; });
assert(kinds.indexOf("E") >= 0, "has E: " + JSON.stringify(kinds));
console.log("ok: diff kinds:", kinds.join(","));

// Apply patch back.
var applied = JSON.parse(JSON.stringify(a));
d.forEach(function (change) {
    DeepDiff.applyChange(applied, true, change);
});
assert(applied.age === 31, "age applied");
assert(applied.tags.length === 2, "tags applied");
console.log("ok: apply round-trip");

console.log("\ndeep-diff smoke: all assertions passed");
