// iso8601-duration: parse + render ISO 8601 duration strings.
// Complements parse-ms / pretty-ms with the P1DT2H3M form.

var mod = require("./vendor/iso8601-duration.js");
var parse = mod.parse || mod.default && mod.default.parse || mod;
var toSeconds = mod.toSeconds;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Parse P1DT2H3M (1 day 2 hours 3 minutes).
var d = parse("P1DT2H3M");
assert(d.days === 1 && d.hours === 2 && d.minutes === 3,
       "P1DT2H3M: " + JSON.stringify(d));
console.log("ok: iso8601-duration.parse");

// Just hours.
var h = parse("PT90M");
assert(h.minutes === 90, "PT90M.minutes=90");
console.log("ok: iso8601-duration parse minutes-only");

// toSeconds.
if (toSeconds) {
    var s = toSeconds({ hours: 1, minutes: 30 });
    assert(s === 5400, "1h30m = 5400s; got " + s);
    console.log("ok: iso8601-duration.toSeconds");
}

console.log("\niso8601-duration smoke: all assertions passed");
