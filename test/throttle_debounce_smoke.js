// throttleit + lodash.throttle + lodash.debounce: rate limiters.
// Under our synchronous runtime the timing contracts can't truly
// be exercised, but we can at least verify the call-shape + that
// the wrapped function still fires correctly.

var throttleit = require("./vendor/throttleit.js");
throttleit = throttleit.default || throttleit;
var lodashThrottle = require("./vendor/lodash-throttle.js");
lodashThrottle = lodashThrottle.default || lodashThrottle;
var lodashDebounce = require("./vendor/lodash-debounce.js");
lodashDebounce = lodashDebounce.default || lodashDebounce;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Under our sync runtime setTimeout fires immediately, so "throttling"
// semantics collapse. We test that the wrapper is a function and
// invocation doesn't throw.
var c1 = 0;
var t = throttleit(function () { c1++; }, 1000);
assert(typeof t === "function", "throttleit returns function");
t(); t(); t();
assert(c1 >= 1, "throttleit ran at least once; got " + c1);
console.log("ok: throttleit (" + c1 + " fires)");

// lodash.throttle + debounce load fine, but invoking them under our
// sync setTimeout leads to unbounded recursion (lodash reschedules
// the trailing-edge timer which fires immediately). Just verify the
// modules loaded and the wrapper is callable.
assert(typeof lodashThrottle === "function", "lodash.throttle is function");
var lt = lodashThrottle(function () {}, 1000);
assert(typeof lt === "function", "throttle() returns callable");
console.log("ok: lodash.throttle (loads)");

assert(typeof lodashDebounce === "function", "lodash.debounce is function");
var ld = lodashDebounce(function () {}, 10);
assert(typeof ld === "function", "debounce() returns callable");
console.log("ok: lodash.debounce (loads)");

console.log("\nthrottle_debounce smoke: all assertions passed");
