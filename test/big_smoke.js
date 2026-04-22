// Smoke test: big.js (arbitrary precision decimal) on ionpower-node.
var Big = require("./vendor/big.js");

function eq(label, got, want) {
    var g = got.toString ? got.toString() : String(got);
    if (g === want) console.log("ok: " + label);
    else { console.error("FAIL: " + label + "\n  got:  " + g + "\n  want: " + want); process.exit(1); }
}

// Basic construction + toString.
eq("construct from int",  new Big(42),        "42");
eq("construct from str",  new Big("1.5"),     "1.5");

// Arithmetic.
eq("1 + 2",              Big(1).plus(2),      "3");
eq("3 - 4",              Big(3).minus(4),     "-1");
eq("7 * 8",              Big(7).times(8),     "56");
eq("22 / 7 at 10 sig",   Big("22").div(7).toPrecision(10), "3.142857143");

// Beyond double precision.
eq("0.1 + 0.2 (exact)",  Big("0.1").plus("0.2"),            "0.3");
eq("big exp",            Big("2").pow(64),      "18446744073709551616");

// Comparison.
var caught = false;
try {
    var c = Big("1.5").cmp(Big("1.50"));
    eq("cmp equal",           c, "0");
} catch (e) { caught = true; }
console.log("caught exception on cmp?", caught);

// abs, neg, sqrt (sqrt returns approximation).
eq("abs(-3)",            Big("-3").abs(),        "3");
eq("sqrt(2) 15 digits",  Big("2").sqrt().toPrecision(15), "1.41421356237310");

console.log("\nbig.js smoke: all assertions passed");
