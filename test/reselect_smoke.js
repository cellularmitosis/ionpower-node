// reselect: memoized selector functions (Redux staple).

var reselect = require("./vendor/reselect.js");
var createSelector = reselect.createSelector;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var calls = 0;
var sumSelector = createSelector(
    function getA(s) { return s.a; },
    function getB(s) { return s.b; },
    function combine(a, b) { calls++; return a + b; }
);

var s1 = { a: 1, b: 2, c: "ignored" };
assert(sumSelector(s1) === 3, "first call: 1+2=3");
assert(calls === 1, "one combine call");

// Same inputs -> memoized.
assert(sumSelector(s1) === 3, "second call same: cache hit");
assert(calls === 1, "still one combine call");
console.log("ok: memoized");

// Change unrelated field -> memoized (inputs unchanged).
assert(sumSelector({ a: 1, b: 2, c: "different" }) === 3, "unrelated change still cached");
assert(calls === 1, "still one");
console.log("ok: unrelated-change cache");

// Change relevant field -> recomputes.
assert(sumSelector({ a: 5, b: 2 }) === 7, "a changed");
assert(calls === 2, "two combine calls now");
console.log("ok: relevant-change recompute");

console.log("\nreselect smoke: all assertions passed");
