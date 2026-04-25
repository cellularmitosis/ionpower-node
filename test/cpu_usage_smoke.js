// process.cpuUsage / resourceUsage smoke + tinybench loaded check.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function unwrap(m) { return (m && m.default) || m; }

// ---- process.cpuUsage ----
assert(typeof process.cpuUsage === "function", "process.cpuUsage present");

var u1 = process.cpuUsage();
assert(typeof u1.user === "number", "cpuUsage.user is number");
assert(typeof u1.system === "number", "cpuUsage.system is number");
assert(u1.user >= 0, "user >= 0");
assert(u1.system >= 0, "system >= 0");

// Burn some CPU
var sum = 0;
for (var i = 0; i < 1000000; i++) sum += i;

var u2 = process.cpuUsage();
assert(u2.user >= u1.user, "user CPU advanced");

// Diff form
var diff = process.cpuUsage(u1);
assert(diff.user >= 0, "diff.user >= 0");
assert(diff.user <= u2.user, "diff <= absolute");
console.log("ok: process.cpuUsage (user delta " + diff.user + " us across 1M-iter loop)");

// ---- process.resourceUsage ----
assert(typeof process.resourceUsage === "function", "resourceUsage present");
var ru = process.resourceUsage();
assert(typeof ru.userCPUTime === "number", "userCPUTime");
assert(typeof ru.systemCPUTime === "number", "systemCPUTime");
assert(typeof ru.maxRSS === "number", "maxRSS (KB)");
assert(typeof ru.minorPageFault === "number", "minorPageFault");
assert(typeof ru.voluntaryContextSwitches === "number", "voluntaryContextSwitches");
console.log("ok: process.resourceUsage");

// ---- tinybench loaded ----
try {
    var tb = require("./vendor/tinybench.js");
    var Bench = tb.Bench || (tb.default && tb.default.Bench);
    if (typeof Bench === "function") {
        var b = new Bench({ time: 50 });
        // Just construct + verify shape — running benchmarks in a smoke is overkill.
        assert(typeof b.add === "function", "Bench.add");
    }
    console.log("ok: tinybench (loaded)");
} catch (e) { console.log("skip: tinybench (" + e.message + ")"); }

console.log("\ncpu_usage smoke: all assertions passed");
