// parse-ms: decompose a ms-duration into { days, hours, minutes, ... }.
// ESM default export; loads via babel.

var parseMs = require("./vendor/parse-ms.js");
parseMs = parseMs.default || parseMs;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

var p = parseMs(1000 * 60 * 60 * 25 + 42 * 1000 + 500);
eq(p.days, 1, "days");
eq(p.hours, 1, "hours");
eq(p.minutes, 0, "minutes");
eq(p.seconds, 42, "seconds");
eq(p.milliseconds, 500, "milliseconds");
console.log("ok: 25h42s500ms parsed");

// Zero.
var z = parseMs(0);
eq(z.days, 0, "zero days");
console.log("ok: zero");

console.log("\nparse-ms smoke: all assertions passed");
