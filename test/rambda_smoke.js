// rambda: leaner/faster Ramda-alike.

var R = require("./vendor/rambda.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(R.map(function (x) { return x * 2; }, [1, 2, 3]), [2, 4, 6], "map");
eq(R.filter(function (x) { return x > 1; }, [1, 2, 3]), [2, 3], "filter");
eq(R.pipe(R.map(function (x) { return x + 1; }), R.sum)([1, 2, 3]), 9, "pipe map+sum");
eq(R.assoc("x", 99, { y: 1 }), { y: 1, x: 99 }, "assoc");
eq(R.path(["a", "b"], { a: { b: 42 } }), 42, "path");
console.log("ok: 5 rambda forms");

console.log("\nrambda smoke: all assertions passed");
