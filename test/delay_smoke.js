// delay: Promise that resolves after N ms. Under our synchronous
// Promise polyfill, delay(ms) still returns a thenable but fires
// immediately; consumers that use delay().then() just sequence.

var delayMod = require("./vendor/delay.js");
var delay = delayMod.default || delayMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Returns a thenable.
var p = delay(50);
assert(p && typeof p.then === "function", "delay() returns a thenable");
console.log("ok: delay returns thenable");

// Resolves to undefined by default.
var resolved = "sentinel";
p.then(function (v) { resolved = v; });
assert(resolved === undefined, "delay resolves to undefined");
console.log("ok: delay resolves undefined");

// delay(ms, { value: X }) resolves to X.
var got = null;
delay(10, { value: "payload" }).then(function (v) { got = v; });
assert(got === "payload", "delay(value) resolves to value");
console.log("ok: delay(value) resolves to provided value");

console.log("\ndelay smoke: all assertions passed");
