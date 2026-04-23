// stable: stable sort (preserves relative order of equal elements).

var stable = require("./vendor/stable.js");
var sort = stable.default || stable;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Sort by age ascending; within the same age, the original order must hold.
var input = [
    { name: "alice", age: 30 },
    { name: "bob",   age: 25 },
    { name: "carol", age: 30 },
    { name: "dave",  age: 25 },
    { name: "eve",   age: 30 }
];
var sorted = sort(input, function (a, b) { return a.age - b.age; });
eq(sorted.map(function (p) { return p.name; }),
   ["bob", "dave", "alice", "carol", "eve"],
   "stable sort preserves within-age order");
console.log("ok: stable sort preserves insertion order");

console.log("\nstable-sort smoke: all assertions passed");
