// simple-statistics: mean/median/stddev/linear-regression.

var ss = require("./vendor/simple-statistics.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
assert(ss.mean(data) === 5.5, "mean 5.5");
assert(ss.median(data) === 5.5, "median 5.5");
assert(Math.abs(ss.standardDeviation(data) - 2.8722813232690143) < 1e-9 ||
       Math.abs(ss.standardDeviation(data) - 3.0276503540974917) < 1e-9,
       "stddev approx: " + ss.standardDeviation(data));
console.log("ok: mean / median / stddev");

// Linear regression.
var lr = ss.linearRegression([[0, 0], [1, 1], [2, 2], [3, 3]]);
assert(Math.abs(lr.m - 1) < 1e-9, "slope 1; got " + lr.m);
assert(Math.abs(lr.b) < 1e-9, "intercept 0; got " + lr.b);
console.log("ok: linear regression y = x");

// Percentile.
var p = ss.quantile(data, 0.5);
assert(p === 5.5, "50th percentile = median");
console.log("ok: quantile(0.5)");

console.log("\nsimple-statistics smoke: all assertions passed");
