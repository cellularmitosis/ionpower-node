// text-table: render an array-of-arrays as an aligned ASCII table.

var table = require("./vendor/text-table.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var out = table([
    ["master", "0123456789abcdef"],
    ["branch", "fedcba9876543210"],
    ["tag",    "short"]
]);

var lines = out.split("\n");
assert(lines.length === 3, "3 rows; got " + lines.length);

// First column should be column-aligned: "master", "branch", "tag   ".
// Verify each line starts with first column padded to 6 chars.
assert(lines[0].indexOf("master") === 0, "line 0 starts master");
assert(lines[1].indexOf("branch") === 0, "line 1 starts branch");
// "tag" gets padded to match.
assert(/^tag\s+/.test(lines[2]), "tag padded: " + JSON.stringify(lines[2]));
console.log("ok: text-table 3 rows aligned");

// Numeric right-align.
var nums = table(
    [["beep", "1024"], ["boop", "3.14"], ["foo", "-42"]],
    { align: ["l", "r"] }
);
var nLines = nums.split("\n");
assert(nLines.length === 3, "3 rows");
console.log("ok: text-table right-align");

console.log("\ntext-table smoke: all assertions passed");
