// micro-memoize: lightweight memoizer (fast-memoize competitor).

var memoize = require("./vendor/micro-memoize.js");
memoize = memoize.default || memoize;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var calls = 0;
function add(a, b) { calls++; return a + b; }

var memoized = memoize(add);
assert(memoized(2, 3) === 5, "2+3");
assert(memoized(2, 3) === 5, "2+3 cached");
assert(calls === 1, "one underlying call; got " + calls);

assert(memoized(2, 4) === 6, "2+4 different args");
assert(calls === 2, "two underlying calls");
console.log("ok: micro-memoize caches repeats");

// Object arg identity.
var obj = { x: 1 };
var call2 = 0;
function getX(o) { call2++; return o.x; }
var mX = memoize(getX);
mX(obj); mX(obj); mX(obj);
assert(call2 === 1, "identity-memoized calls: " + call2);
console.log("ok: micro-memoize identity arg");

console.log("\nmicro-memoize smoke: all assertions passed");
