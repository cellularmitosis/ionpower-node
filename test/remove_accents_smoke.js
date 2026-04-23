// remove-accents: NFD-lite, strips diacritics.

var ra = require("./vendor/remove-accents.js");
var removeAccents = ra.remove || ra;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(removeAccents("café"),      "cafe",      "café -> cafe");
eq(removeAccents("naïve"),     "naive",     "naïve -> naive");
eq(removeAccents("Pokémon"),   "Pokemon",   "Pokémon -> Pokemon");
eq(removeAccents("Crème brûlée"), "Creme brulee", "Crème brûlée");
eq(removeAccents("plain ASCII"), "plain ASCII", "ASCII untouched");
console.log("ok: remove-accents (5 cases)");

// .has() predicate.
if (typeof ra.has === "function") {
    if (!ra.has("café")) { console.error("FAIL: .has(café)"); process.exit(1); }
    if (ra.has("plain")) { console.error("FAIL: .has(plain)"); process.exit(1); }
    console.log("ok: remove-accents.has");
}

console.log("\nremove-accents smoke: all assertions passed");
