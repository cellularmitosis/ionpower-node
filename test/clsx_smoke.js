// clsx: smaller, faster alternative to classnames.

var clsx = require("./vendor/clsx.js").clsx || require("./vendor/clsx.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(clsx("a", "b"), "a b", "strings");
eq(clsx({ a: true, b: false, c: 1 }), "a c", "object truthy");
eq(clsx(["a", "b", { c: true }]), "a b c", "array mixed");
eq(clsx(null, undefined, false, "x", 0, "y"), "x y", "falsy filtered");
console.log("ok: 4 clsx forms");

console.log("\nclsx smoke: all assertions passed");
