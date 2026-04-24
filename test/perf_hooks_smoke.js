// perf_hooks + globalThis.performance smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- require('perf_hooks') surface ---
var ph = require("perf_hooks");
assert(typeof ph === "object", "perf_hooks is an object");
assert(typeof ph.performance === "object", "has performance");
assert(typeof ph.performance.now === "function", "performance.now is a function");
assert(typeof ph.performance.timeOrigin === "number", "performance.timeOrigin is a number");
assert(typeof ph.PerformanceObserver === "function", "PerformanceObserver is a ctor");
console.log("ok: perf_hooks surface");

// --- performance.now() basics ---
var a = ph.performance.now();
var b = ph.performance.now();
assert(typeof a === "number", "now() returns a number");
assert(b >= a, "now() is monotonic");
assert(a >= 0, "now() is non-negative (from timeOrigin)");
console.log("ok: performance.now basics");

// --- global performance is the same ---
assert(typeof performance === "object", "global performance exists");
assert(typeof performance.now === "function", "global performance.now");
assert(performance === ph.performance, "global performance === perf_hooks.performance");
console.log("ok: globalThis.performance === perf_hooks.performance");

// --- mark / measure / clear are callable (stubs) ---
ph.performance.mark("start");
ph.performance.mark("end");
ph.performance.measure("span", "start", "end");
ph.performance.clearMarks();
ph.performance.clearMeasures();
assert(Array.isArray(ph.performance.getEntries()), "getEntries returns array");
console.log("ok: mark/measure/getEntries (stubs)");

// --- PerformanceObserver is constructible + has observe/disconnect ---
var calls = 0;
var obs = new ph.PerformanceObserver(function () { calls++; });
obs.observe({ entryTypes: ["measure"] });
obs.disconnect();
assert(Array.isArray(obs.takeRecords()), "takeRecords returns array");
console.log("ok: PerformanceObserver shape");

// --- timeOrigin matches Date.now() ballpark ---
var clockDiff = Date.now() - ph.performance.timeOrigin;
assert(clockDiff >= 0, "timeOrigin <= Date.now()");
assert(clockDiff < 60 * 60 * 1000, "timeOrigin within the last hour");
console.log("ok: timeOrigin reasonable");

// --- Use now() around a small loop, duration is non-negative ---
var t0 = performance.now();
var sum = 0;
for (var i = 0; i < 100000; i++) sum += i;
var t1 = performance.now();
assert(t1 - t0 >= 0, "duration non-negative");
console.log("ok: now() around a loop (took " + (t1 - t0).toFixed(0) + "ms, sum=" + sum + ")");

console.log("\nperf_hooks smoke: all assertions passed");
