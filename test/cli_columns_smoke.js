// cli-columns: arrange string list into aligned columns (think `ls` output).

var columns = require("./vendor/cli-columns.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var items = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
var out = columns(items, { width: 40, newline: "\n" });
assert(typeof out === "string", "returns string");
assert(out.length > 0, "non-empty");

// All 6 items should appear in the output.
items.forEach(function (it) {
    assert(out.indexOf(it) !== -1, "item " + it + " present");
});
console.log("ok: cli-columns 6 items rendered to 40-col width");

// Multi-line.
assert(out.indexOf("\n") !== -1, "output has newlines");
console.log("ok: cli-columns output is multi-line");

console.log("\ncli-columns smoke: all assertions passed");
