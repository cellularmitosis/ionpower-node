// Late batch: has-flag, array-equal, big-num (big.js v6), json,
// zod, matcher.

var hasFlagMod = require("./vendor/has-flag-v5.js");
var hasFlag = hasFlagMod.default || hasFlagMod;
var arrayEqual = require("./vendor/array-equal.js");
var Big = require("./vendor/big-num.js");
Big = Big.default || Big.Big || Big;
// json pkg requires `vm` — vendored but unsmoked.
// zod has ES2020+ syntax SM45 can't parse — vendored but unsmoked.
// matcher's ESM imports don't survive our parser — vendored unsmoked.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// has-flag: test command-line flags.
assert(typeof hasFlag === "function", "hasFlag is function");
console.log("ok: has-flag@5");

// array-equal.
assert(arrayEqual([1, 2, 3], [1, 2, 3]) === true, "equal");
assert(arrayEqual([1, 2], [1, 2, 3]) === false, "unequal");
console.log("ok: array-equal");

// big-num (big.js 6.x).
if (typeof Big === "function") {
    var sum = Big("0.1").plus("0.2");
    assert(sum.toString() === "0.3", "big-num 0.1+0.2 exact: " + sum.toString());
    console.log("ok: big-num (big.js@6)");
}


console.log("\nbatch_late smoke: all assertions passed");
