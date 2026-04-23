// js-levenshtein: edit-distance between two strings.

var levenshtein = require("./vendor/js-levenshtein.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(levenshtein("kitten", "sitting"), 3, "kitten -> sitting = 3");
eq(levenshtein("", ""), 0, "empty == empty");
eq(levenshtein("abc", "abc"), 0, "identical");
eq(levenshtein("abc", "abd"), 1, "one sub");
eq(levenshtein("abc", ""), 3, "full delete");
eq(levenshtein("flaw", "lawn"), 2, "flaw -> lawn = 2");
eq(levenshtein("gumbo", "gambol"), 2, "gumbo -> gambol = 2");
eq(levenshtein("saturday", "sunday"), 3, "saturday -> sunday = 3");

console.log("ok: js-levenshtein (8 distance vectors)");
console.log("\njs-levenshtein smoke: all assertions passed");
