// string-similarity: Dice's coefficient between two strings.

var ss = require("./vendor/string-similarity.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var c1 = ss.compareTwoStrings("hello", "hello");
assert(c1 === 1, "identical = 1");
console.log("ok: identical");

var c2 = ss.compareTwoStrings("hello", "world");
assert(c2 >= 0 && c2 <= 1, "comparable in range: " + c2);
console.log("ok: hello/world =", c2);

var c3 = ss.compareTwoStrings("Tiger", "tiger");  // case differs
assert(c3 < 1, "case-sensitive differs: " + c3);
console.log("ok: case-sensitive =", c3);

// findBestMatch
var bm = ss.findBestMatch("application", ["app", "apple", "banana", "applicable"]);
assert(bm.bestMatch.target === "applicable" || bm.bestMatch.target === "apple",
       "best match: " + bm.bestMatch.target);
console.log("ok: findBestMatch picked", bm.bestMatch.target);

console.log("\nstring-similarity smoke: all assertions passed");
