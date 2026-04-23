// leven: fast string edit distance.

var leven = require("./vendor/leven.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(leven("", ""), 0, "empty-empty");
eq(leven("abc", "abc"), 0, "equal");
eq(leven("abc", "abd"), 1, "one substitution");
eq(leven("sitting", "kitten"), 3, "sitting/kitten");
eq(leven("PowerPC", "Tiger"), 5, "PowerPC vs Tiger");
eq(leven("G3", "G5"), 1, "G3 vs G5");
console.log("ok: 6 leven distances");

console.log("\nleven smoke: all assertions passed");
