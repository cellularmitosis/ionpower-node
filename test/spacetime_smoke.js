// spacetime: timezone-aware date handling.

var spacetime = require("./vendor/spacetime.js");
spacetime = spacetime.default || spacetime;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var s = spacetime("2026-04-22 12:00:00", "America/Los_Angeles");
assert(s.year() === 2026, "year");
assert(s.month() === 3,   "month (0-indexed; April = 3)");
assert(s.date() === 22,   "day");
assert(typeof s.hour() === "number", "hour");
console.log("ok: parse + accessors");

// Goto another zone.
var n = s.goto("America/New_York");
// 3-hour difference assuming same UTC.
var diff = n.hour() - s.hour();
assert(diff === 3 || diff === -21, "NY is 3h ahead of LA: " + diff);
console.log("ok: goto LA -> NY: " + s.format("{hour}:{minute}") + " -> " + n.format("{hour}:{minute}"));

// Format.
var f = s.format("iso");
assert(typeof f === "string" && f.length > 10, "iso format: " + f);
console.log("ok: iso format:", f);

console.log("\nspacetime smoke: all assertions passed");
