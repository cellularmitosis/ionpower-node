// just-pick / just-omit / just-compare: tiny tree-shakable helpers.

var pick    = require("./vendor/just-pick.js");
var omit    = require("./vendor/just-omit.js");
var compare = require("./vendor/just-compare.js");

function eq(a, b, msg) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) { console.error("FAIL:", msg, "expected", sb, "got", sa); process.exit(1); }
}

var obj = { a: 1, b: 2, c: 3 };
eq(pick(obj, ["a", "c"]), { a: 1, c: 3 }, "pick");
console.log("ok: pick");

eq(omit(obj, ["b"]), { a: 1, c: 3 }, "omit");
console.log("ok: omit");

if (compare({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }) !== true) {
    console.error("FAIL: compare equal objects"); process.exit(1);
}
if (compare({ a: 1 }, { a: 2 }) !== false) {
    console.error("FAIL: compare different"); process.exit(1);
}
console.log("ok: compare");

console.log("\njust-* smoke: all assertions passed");
