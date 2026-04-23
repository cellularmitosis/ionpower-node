// onetime: ensure a function runs only once; subsequent calls return
// the cached first result. Used by ora / restore-cursor / etc.

var otMod = require("./vendor/onetime.js");
var onetime = otMod.default || otMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var calls = 0;
function increment() { calls++; return "once"; }

var wrapped = onetime(increment);
var r1 = wrapped(), r2 = wrapped(), r3 = wrapped();
assert(r1 === "once" && r2 === "once" && r3 === "once", "all calls return 'once'");
assert(calls === 1, "underlying called only once; got " + calls);
console.log("ok: onetime (called 1x; wrapped called 3x)");

// onetime.callCount exposes how many times wrapped was invoked.
if (typeof onetime.callCount === "function") {
    assert(onetime.callCount(wrapped) === 3, "callCount = 3");
    console.log("ok: onetime.callCount");
}

console.log("\nonetime smoke: all assertions passed");
