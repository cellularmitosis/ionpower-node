// fecha: small date format/parse library (alternative to dayjs / moment).

var fecha = require("./vendor/fecha.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Format.
var d = new Date(Date.UTC(2026, 3, 22, 15, 30, 45)); // 2026-04-22 15:30:45 UTC
eq(fecha.format(d, "YYYY-MM-DD", {}), "2026-04-22", "date format YYYY-MM-DD");
console.log("ok: fecha.format YYYY-MM-DD");

// Parse and re-format.
var parsed = fecha.parse("2026-01-02 03:04:05", "YYYY-MM-DD HH:mm:ss");
assert(parsed instanceof Date, "parsed is Date; got " + parsed);
assert(parsed.getFullYear() === 2026, "year 2026 got " + parsed.getFullYear());
assert(parsed.getMonth() === 0, "month 0 got " + parsed.getMonth());
console.log("ok: fecha.parse");

// Default formats.
eq(fecha.format(d, "mediumDate"), "Apr 22, 2026", "mediumDate");
console.log("ok: fecha mediumDate preset");

console.log("\nfecha smoke: all assertions passed");
