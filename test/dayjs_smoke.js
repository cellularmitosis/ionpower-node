// Smoke test: dayjs 1.11 (date lib, moment-alternative) on ionpower-node.
var dayjs = require("./vendor/dayjs.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    if (String(got) === String(want)) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label + "\n  got: " + got + "\n  want: " + want); }
}

// Known fixed date so tests don't depend on the current clock.
var d = dayjs("2026-04-21T12:34:56.000Z");
eq("year",    d.year(),    2026);
eq("month",   d.month(),   3);     // 0-indexed: April
eq("date",    d.date(),    21);
eq("day",     d.day(),     2);     // Tuesday (0=Sunday)

// Formatting.
eq("format YYYY-MM-DD",  d.format("YYYY-MM-DD"),  "2026-04-21");
eq("format HH:mm",       d.utc ? "utc plugin required" : /\d\d:\d\d/.test(d.format("HH:mm")),
   d.utc ? "utc plugin required" : true);
// Note: default tz is local; format just checks shape.

// Arithmetic.
eq("add 7 days",    d.add(7, "day").format("YYYY-MM-DD"),    "2026-04-28");
eq("subtract 1 mo", d.subtract(1, "month").format("YYYY-MM-DD"), "2026-03-21");

// Comparison.
eq("isBefore", d.isBefore(d.add(1, "second")), true);
eq("isAfter",  d.isAfter(d.subtract(1, "day")), true);
eq("isSame",   d.isSame(dayjs("2026-04-21T12:34:56.000Z")), true);

// Parse variants.
eq("parse yyyymmdd", dayjs("2020-01-15").format("YYYY-MM-DD"), "2020-01-15");

// Diff
var later = d.add(3, "day");
eq("diff days",   later.diff(d, "day"),   3);
eq("diff hours",  later.diff(d, "hour"), 72);

console.log("\ndayjs smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
