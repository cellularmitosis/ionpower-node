// tsv: tab-separated-value parser.

var tsv = require("./vendor/tsv.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var table = [
    "name\tage\tcity",
    "alice\t30\tportland",
    "bob\t25\tsyracuse"
].join("\n");

var rows = tsv.parse(table);
eq(rows.length, 2, "row count 2");
eq(rows[0].name, "alice", "alice row name");
eq(rows[0].age, 30, "alice age (auto-coerced to number)");
eq(rows[1].city, "syracuse", "bob city");
console.log("ok: parse");

// stringify.
var out = tsv.stringify([
    { name: "eve", age: 20 }
]);
if (out.indexOf("name\tage") < 0) { console.error("FAIL: stringify header"); process.exit(1); }
if (out.indexOf("eve\t20") < 0)   { console.error("FAIL: stringify row"); process.exit(1); }
console.log("ok: stringify");

console.log("\ntsv smoke: all assertions passed");
