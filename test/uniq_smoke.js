// uniq: deduplicate arrays.

var uniq = require("./vendor/uniq.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(uniq([1, 1, 2, 3, 3, 3]), [1, 2, 3], "numbers");
eq(uniq(["a", "a", "b"]), ["a", "b"], "strings");
eq(uniq([]), [], "empty");
console.log("ok: 3 uniq forms");

// Custom comparator.
var out = uniq(
    [{ a: 1 }, { a: 1 }, { a: 2 }],
    function (x, y) { return x.a - y.a; }
);
eq(out.length, 2, "custom comparator de-dupes object");
console.log("ok: uniq custom comparator");

console.log("\nuniq smoke: all assertions passed");
