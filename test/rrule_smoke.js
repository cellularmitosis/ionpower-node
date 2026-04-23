// rrule: RFC 5545 recurring-event expansion (iCal RRULE:FREQ=WEEKLY etc).

var rruleMod = require("./vendor/rrule.js");
var RRule = rruleMod.RRule || rruleMod.default || rruleMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// 3 weekly instances starting 2026-04-23.
var rule = new RRule({
    freq: RRule.WEEKLY,
    count: 3,
    dtstart: new Date(Date.UTC(2026, 3, 23))
});

var occ = rule.all();
assert(Array.isArray(occ), "all() returns array");
assert(occ.length === 3, "3 occurrences; got " + occ.length);

// Differences should be one week.
var diff1 = (occ[1].getTime() - occ[0].getTime()) / (1000 * 60 * 60 * 24);
var diff2 = (occ[2].getTime() - occ[1].getTime()) / (1000 * 60 * 60 * 24);
assert(diff1 === 7, "week gap 1: " + diff1);
assert(diff2 === 7, "week gap 2: " + diff2);
console.log("ok: rrule weekly (3 occurrences)");

// toString roundtrip.
var s = rule.toString();
assert(typeof s === "string" && s.indexOf("FREQ=WEEKLY") !== -1, "toString: " + s);
console.log("ok: rrule.toString includes FREQ=WEEKLY");

console.log("\nrrule smoke: all assertions passed");
