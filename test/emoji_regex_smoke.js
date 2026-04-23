// emoji-regex: detect emoji (including ZWJ sequences) in strings.

var emojiRegex = require("./vendor/emoji-regex.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// The default export is a factory that returns a fresh regex each time.
// Newer versions also expose a .default property.
var re = (emojiRegex.default || emojiRegex)();
assert(re instanceof RegExp, "got a RegExp: " + re);

// match some easy cases. SM45 lacks full Unicode property support; we're
// exercising the already-compiled regex, so that's OK — the regex body
// is literal character-class ranges.
var text = "Hello \uD83D\uDC4B world!";
var m = text.match(re);
assert(m && m.length >= 1, "matched wave emoji: " + JSON.stringify(m));
console.log("ok: wave emoji matched");

console.log("\nemoji-regex smoke: all assertions passed");
