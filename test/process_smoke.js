// process.hrtime / uptime / title / versions / memoryUsage / release.
// New additions in this session.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// hrtime: [s, ns] pair.
var h1 = process.hrtime();
assert(Array.isArray(h1) && h1.length === 2, "hrtime returns [s, ns]");
assert(typeof h1[0] === "number" && typeof h1[1] === "number", "both numbers");
console.log("ok: process.hrtime()", JSON.stringify(h1));

// hrtime(prev): delta
var h2 = process.hrtime(h1);
assert(h2[0] >= 0 && h2[1] >= 0, "delta non-negative");
console.log("ok: process.hrtime(prev) delta:", JSON.stringify(h2));

// hrtime.bigint
var b = process.hrtime.bigint();
assert(typeof b === "number", "bigint returns a number on SM45");
console.log("ok: process.hrtime.bigint =", b);

// uptime
var u = process.uptime();
assert(typeof u === "number" && u >= 0, "uptime non-negative: " + u);
console.log("ok: process.uptime =", u);

// title
assert(typeof process.title === "string", "title is string");
console.log("ok: process.title =", JSON.stringify(process.title));

// versions
assert(typeof process.versions === "object", "versions is object");
assert(typeof process.versions.node === "string", "versions.node is string");
// 'ionpower-node' is dashed; bracket form because of the dash.
assert(typeof process.versions["ionpower-node"] === "string",
       "versions['ionpower-node'] is string");
console.log("ok: process.versions =", JSON.stringify(process.versions));

// release
assert(typeof process.release === "object", "release is object");
assert(typeof process.release.name === "string", "release.name is string");
console.log("ok: process.release =", JSON.stringify(process.release));

// memoryUsage
var m = process.memoryUsage();
assert(typeof m === "object" && "rss" in m, "memoryUsage has rss");
console.log("ok: process.memoryUsage =", JSON.stringify(m));

console.log("\nprocess smoke: all assertions passed");
