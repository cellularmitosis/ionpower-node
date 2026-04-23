// fromentries: Object.fromEntries polyfill.

var fromEntries = require("./vendor/fromentries.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(fromEntries([["a", 1], ["b", 2]]), { a: 1, b: 2 }, "array of tuples");
eq(fromEntries([]), {}, "empty");
console.log("ok: 2 fromentries forms");

console.log("\nfromentries smoke: all assertions passed");
