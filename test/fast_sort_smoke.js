// fast-sort: fluent, fast sorting (asc/desc/by-field/by-multiple).

var sort = require("./vendor/fast-sort.js");
sort = sort.sort || sort;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var rows = [
    { name: "bob",   age: 25 },
    { name: "alice", age: 30 },
    { name: "carol", age: 25 }
];

// By single field, asc.
var byAge = sort(rows.slice()).asc("age");
eq(byAge.map(function (r) { return r.name; }),
   ["bob", "carol", "alice"], "asc age");

// Multi-field.
var multi = sort(rows.slice()).by([{ asc: "age" }, { asc: "name" }]);
eq(multi.map(function (r) { return r.name; }),
   ["bob", "carol", "alice"], "by age then name");
console.log("ok: 2 fast-sort forms");

console.log("\nfast-sort smoke: all assertions passed");
