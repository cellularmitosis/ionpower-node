// char-regex: regex that matches a single "user-perceived character"
// (counts emojis as one).

var charRegex = require("./vendor/char-regex.js");
charRegex = charRegex.default || charRegex;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var re = charRegex();
assert(re instanceof RegExp, "RegExp");
var all = "hi👋world".match(re);
assert(all && all.length === 8,
       "matched chars len 8 (h,i, wave-emoji-as-one, w,o,r,l,d): " + (all && all.length));
console.log("ok: 'hi👋world' matched", all.length, "chars");

console.log("\nchar-regex smoke: all assertions passed");
