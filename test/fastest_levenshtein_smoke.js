// fastest-levenshtein: another edit-distance impl, focus on speed.

var m = require("./vendor/fastest-levenshtein.js");
var distance = m.distance;
var closest  = m.closest;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(distance("", ""), 0, "empty-empty");
eq(distance("abc", "abc"), 0, "equal");
eq(distance("sitting", "kitten"), 3, "sitting/kitten");
eq(distance("saturday", "sunday"), 3, "saturday/sunday");
console.log("ok: distance");

// closest match from candidate list.
var best = closest("Gb", ["GB", "G3", "G4", "G5"]);
// Case-sensitive, so lowest distance among those is "G3"/"G4"/"G5"/"GB" = 1.
// All have distance 1; first-wins in most impls.
if (best !== "GB" && best !== "G3" && best !== "G4" && best !== "G5") {
    console.error("FAIL: closest not one of GB/G3/G4/G5:", best);
    process.exit(1);
}
console.log("ok: closest('Gb', [GB,G3,G4,G5]) =", best);

console.log("\nfastest-levenshtein smoke: all assertions passed");
