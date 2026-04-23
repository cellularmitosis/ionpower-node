// XRegExp: extended regex (named groups, Unicode property classes, etc.)

var XRegExp = require("./vendor/xregexp.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Named capture groups via XRegExp. v5 exposes them under .groups.
var re = XRegExp('(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})');
var m = XRegExp.exec('2026-04-22', re);
var grp = m && (m.groups || m);  // v5 uses .groups; older forms pin directly
assert(grp && grp.year === '2026', "year: " + (grp && grp.year));
assert(grp && grp.month === '04', "month: " + (grp && grp.month));
assert(grp && grp.day === '22', "day: " + (grp && grp.day));
console.log("ok: named groups year/month/day");

// XRegExp.replace with named references.
var swapped = XRegExp.replace('2026-04-22', re, '${day}/${month}/${year}');
assert(swapped === '22/04/2026', "swapped: " + swapped);
console.log("ok: named-reference replace");

// Unicode property (requires the unicode addon; test basic /\pL/ fallback).
// XRegExp's full unicode support is lazy-loaded; skip if unavailable.
try {
    var word = XRegExp('\\pL+', 'A');
    var words = XRegExp.match('Hello Tiger 2026', word, 'all');
    assert(words.length === 2, "matched 2 letter-runs: " + words);
    console.log("ok: unicode letter class /\\pL+/");
} catch (e) {
    console.log("skip: unicode letter class (addon not loaded):", e.message);
}

console.log("\nxregexp smoke: all assertions passed");
