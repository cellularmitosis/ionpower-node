// humanize-duration: 123456 -> "2 minutes, 3.456 seconds".

var humanize = require("./vendor/humanize-duration.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var s = humanize(1000 * 60 * 60 * 25);  // 25 hours
assert(s.indexOf("day") >= 0 && s.indexOf("hour") >= 0, "25h produces day+hour phrase: " + s);
console.log("ok: 25h -> " + s);

// Spanish.
var sp = humanize(5000, { language: "es" });
assert(sp.indexOf("segundo") >= 0, "es: segundo: " + sp);
console.log("ok: es: 5s -> " + sp);

// Round + units.
var rd = humanize(1234 * 60 * 1000, { round: true, units: ["h", "m"] });
assert(rd.indexOf("minute") >= 0 || rd.indexOf("hour") >= 0, "units: " + rd);
console.log("ok: units+round -> " + rd);

console.log("\nhumanize-duration smoke: all assertions passed");
