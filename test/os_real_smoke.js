// os.cpus / hostname / loadavg / freemem / totalmem now probe the
// host via sysctl + vm_stat instead of returning placeholder values.

var os = require("os");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- os.cpus(): real model + speed via hw.cpusubtype + hw.cpufrequency ----
var cpus = os.cpus();
assert(Array.isArray(cpus) && cpus.length >= 1, "cpus is non-empty array");
var c0 = cpus[0];
assert(typeof c0.model === "string" && c0.model.indexOf("PowerPC") === 0,
       "model starts with 'PowerPC' (got " + JSON.stringify(c0.model) + ")");
assert(/G3 \(750\)|G4 \(7400\)|G4 \(7450\)|G5 \(970\)/.test(c0.model),
       "model resolves to a real PPC variant: " + c0.model);
assert(typeof c0.speed === "number" && c0.speed > 100 && c0.speed < 5000,
       "speed in plausible range MHz (got " + c0.speed + ")");
assert(c0.times && typeof c0.times === "object", "times object present");
console.log("ok: os.cpus() = " + JSON.stringify(cpus));

// ---- os.hostname(): real /bin/hostname output ----
var h = os.hostname();
assert(typeof h === "string" && h.length > 0, "hostname non-empty");
console.log("ok: os.hostname() = " + h);

// ---- os.loadavg(): three numbers from `uptime` ----
var la = os.loadavg();
assert(Array.isArray(la) && la.length === 3, "loadavg is [3]");
assert(la.every(function (n) { return typeof n === "number" && !isNaN(n); }),
       "all three are numbers");
console.log("ok: os.loadavg() = [" + la.join(", ") + "]");

// ---- os.totalmem(): real hw.memsize ----
var t = os.totalmem();
assert(typeof t === "number" && t > 0, "totalmem > 0 (got " + t + ")");
assert(t < 1024 * 1024 * 1024 * 1024, "totalmem reasonable (< 1 TB)");
console.log("ok: os.totalmem() = " + t + " bytes (" + Math.round(t / (1024 * 1024)) + " MB)");

// ---- os.freemem(): real vm_stat output ----
var f = os.freemem();
// Free memory varies wildly; just sanity-check it's a number and < total.
assert(typeof f === "number" && f >= 0, "freemem >= 0 (got " + f + ")");
assert(f <= t, "freemem (" + f + ") <= totalmem (" + t + ")");
console.log("ok: os.freemem() = " + f + " bytes (" + Math.round(f / (1024 * 1024)) + " MB)");

// ---- Cached: hostname + cpus + totalmem cache after first call ----
var h2 = os.hostname();
assert(h2 === h, "hostname cached");
var cpus2 = os.cpus();
assert(cpus2[0].model === c0.model, "cpus cached");
console.log("ok: caching of expensive probes");

console.log("\nos_real smoke: all assertions passed");
