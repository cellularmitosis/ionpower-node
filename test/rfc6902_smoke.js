// rfc6902: JSON patch (create/apply diffs).

var jsonpatch = require("./vendor/rfc6902.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var a = { name: "alice", age: 30, tags: ["x", "y"] };
var b = { name: "alice", age: 31, tags: ["x", "z", "q"] };

// Create patch.
var patch = jsonpatch.createPatch(a, b);
assert(Array.isArray(patch), "createPatch returns array");
console.log("ok: createPatch length:", patch.length);

// Apply to a copy of a, expect b.
var target = JSON.parse(JSON.stringify(a));
var errs = jsonpatch.applyPatch(target, patch);
assert(errs.every(function (e) { return e === null; }),
       "applyPatch success: " + JSON.stringify(errs));
eq(target, b, "target now equals b");
console.log("ok: applyPatch round-trip");

console.log("\nrfc6902 smoke: all assertions passed");
