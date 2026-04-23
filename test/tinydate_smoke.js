// tinydate: 400-byte date formatter.

var tinydate = require("./vendor/tinydate.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var stamp = tinydate("{YYYY}-{MM}-{DD} {HH}:{mm}:{ss}");
var d = new Date(Date.UTC(2026, 3, 22, 15, 30, 45));
var s = stamp(d);
// Local-time format depends on TZ; just check shape.
assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s), "shape: " + s);
console.log("ok: basic format:", s);

// Custom literal + brace.
var tpl = tinydate("[{YYYY}]");
assert(/^\[\d{4}\]$/.test(tpl(d)), "bracket literal: " + tpl(d));
console.log("ok: literals");

console.log("\ntinydate smoke: all assertions passed");
