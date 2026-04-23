// eastasianwidth: classify each code point by East Asian width
// property (F/W/A/H/Na/N). Used by string-width for CJK alignment.

var eaw = require("./vendor/eastasianwidth.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Length (in display cells).
assert(eaw.length("hello") === 5, "ASCII length=5");
assert(eaw.length("古池や") === 6, "hiragana 2-cell per char: " + eaw.length("古池や"));
console.log("ok: eastasianwidth.length");

// characterLength on a single char.
assert(eaw.characterLength("A") === 1, "A = 1");
assert(eaw.characterLength("古") === 2, "古 = 2");
console.log("ok: eastasianwidth.characterLength");

// eastAsianWidth classification.
assert(eaw.eastAsianWidth("A") === "Na", "A is Na (Narrow)");
assert(eaw.eastAsianWidth("古") === "W",  "古 is W (Wide)");
console.log("ok: eastasianwidth.eastAsianWidth");

console.log("\neastasianwidth smoke: all assertions passed");
