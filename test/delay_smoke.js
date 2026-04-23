// delay: Promise that resolves after N ms. Now that our timer queue
// defers setTimeout, delay(50).then(cb) really waits — the callback
// fires during __drain_timers__ after this script body returns.

var delayMod = require("./vendor/delay.js");
var delay = delayMod.default || delayMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Returns a thenable.
var p = delay(50);
assert(p && typeof p.then === "function", "delay() returns a thenable");
console.log("ok: delay returns thenable");

// Resolves to undefined by default. Verified via process.on('exit').
var resolved = "sentinel";
p.then(function (v) { resolved = v; });

// delay(ms, { value: X }) resolves to X.
var got = "sentinel";
delay(10, { value: "payload" }).then(function (v) { got = v; });

// With the timer queue, both callbacks fire during drain. Check at exit.
process.on("exit", function () {
    assert(resolved === undefined, "delay resolves to undefined (got " + resolved + ")");
    console.log("ok: delay resolves undefined");
    assert(got === "payload", "delay(value) resolves to payload (got " + got + ")");
    console.log("ok: delay(value) resolves to provided value");
    console.log("\ndelay smoke: all assertions passed");
});
