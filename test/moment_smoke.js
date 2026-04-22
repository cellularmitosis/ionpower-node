// Smoke test: moment 2.30 (legacy but heavily used date lib) on
// ionpower-node. Comparison point against the dayjs (7 KB) version
// already in compat target 17.
var moment = require("./vendor/moment.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var d = moment.utc("2026-04-22T12:00:00Z");
assert(d.year() === 2026, "year");
assert(d.month() === 3, "month (0-indexed)");   // April
assert(d.date() === 22, "date");
assert(d.format("YYYY-MM-DD") === "2026-04-22", "format");
console.log("ok: parse + accessors + format");

// Arithmetic
assert(d.clone().add(7, "days").format("YYYY-MM-DD") === "2026-04-29", "add days");
assert(d.clone().subtract(1, "month").format("YYYY-MM-DD") === "2026-03-22", "subtract month");
console.log("ok: arithmetic");

// Diff
var later = d.clone().add(3, "hours");
assert(later.diff(d, "minutes") === 180, "diff minutes");
console.log("ok: diff");

// Locale defaults
assert(typeof moment().locale() === "string", "has locale");

// From-now (relative) — sanity only, don't depend on wall clock value
var s = moment().fromNow();
assert(typeof s === "string" && s.length > 0, "fromNow returns a string: " + s);
console.log("ok: fromNow:", s);

console.log("\nmoment smoke: all assertions passed");
