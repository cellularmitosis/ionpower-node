// pad-left + pad-right.

var padLeft  = require("./vendor/pad-left.js");
var padRight = require("./vendor/pad-right.js");

function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); } }

eq(padLeft("7",  3, "0"),  "007",  "pad-left zero");
eq(padLeft("hi", 5),       "   hi", "pad-left space default");
eq(padLeft("already wide", 3), "already wide", "no trim");
console.log("ok: pad-left");

// pad-right defaults to '0' as its fill char (unlike pad-left).
eq(padRight("7",  3, "0"),  "700",    "pad-right zero");
eq(padRight("7",  3),       "700",    "pad-right default zero");
eq(padRight("hi", 5, " "),  "hi   ",  "pad-right explicit space");
console.log("ok: pad-right");

console.log("\npad_lr smoke: all assertions passed");
