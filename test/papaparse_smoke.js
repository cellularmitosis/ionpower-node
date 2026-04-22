// Smoke test: PapaParse 5.4.1 (CSV parser/emitter) on ionpower-node.

const Papa = require("./vendor/papaparse.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    if (JSON.stringify(got) === JSON.stringify(want)) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label +
                                    "\n  got:  " + JSON.stringify(got) +
                                    "\n  want: " + JSON.stringify(want)); }
}

// Simple CSV with header. skipEmptyLines prevents a trailing empty
// row from the last "\n".
var csv = "name,age,role\nalice,30,dev\nbob,25,pm\n";
var r = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
eq("csv header",
   r.data,
   [{ name: "alice", age: 30, role: "dev" },
    { name: "bob",   age: 25, role: "pm" }]);
eq("no errors", r.errors.length, 0);

// Quoted fields with commas.
var csv2 = 'a,b,c\n"hello, world",42,"he said ""hi"""\n';
var r2 = Papa.parse(csv2, { header: true });
eq("quoted comma",  r2.data[0].a, "hello, world");
eq("escaped quote", r2.data[0].c, 'he said "hi"');

// Arrays mode (no header).
var csv3 = "1,2,3\n4,5,6\n";
var r3 = Papa.parse(csv3, { dynamicTyping: true, skipEmptyLines: true });
eq("array mode", r3.data, [[1, 2, 3], [4, 5, 6]]);

// unparse (emit CSV). Papa defaults to \r\n line endings; override to \n
// for a more predictable test.
var rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
var out = Papa.unparse(rows, { newline: "\n" });
eq("unparse",
   out.split("\n"),
   ["a,b", "1,2", "3,4"]);

// Round-trip
var original = [
    { tag: "bug",     count: 12, priority: "high" },
    { tag: "feature", count: 5,  priority: "med"  }
];
var rt = Papa.parse(Papa.unparse(original), { header: true, dynamicTyping: true });
eq("round-trip", rt.data, original);

console.log("\npapaparse smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
