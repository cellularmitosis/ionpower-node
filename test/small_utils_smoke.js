// A grab-bag of tiny utility libraries, all standalone single-file CJS.

var abbrev           = require("./vendor/abbrev.js");
var wordWrap         = require("./vendor/word-wrap.js");
var stripJsonComments = require("./vendor/strip-json-comments.js");
var repeatString     = require("./vendor/repeat-string.js");
var titleCase        = require("./vendor/title-case.js").titleCase;

abbrev = abbrev.default || abbrev;
wordWrap = wordWrap.default || wordWrap;
stripJsonComments = stripJsonComments.default || stripJsonComments;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// abbrev: Npm-style minimum-unique-prefix table.
var ab = abbrev(["install", "uninstall", "update"]);
assert(ab.install === "install" && ab.in === "install", "install + in");
assert(ab.uninstall === "uninstall" && ab.un === "uninstall", "un");
console.log("ok: abbrev");

// word-wrap.
var wrapped = wordWrap("The quick brown fox jumps over the lazy dog", { width: 10 });
assert(wrapped.split("\n").length >= 3, "wrapped to multiple lines");
console.log("ok: word-wrap");

// strip-json-comments: replaces comments with spaces preserving length.
var sjc = stripJsonComments('{ /* c */ "a": 1 // trail\n }');
// Exact whitespace depends on implementation; check comments absent.
if (sjc.indexOf("/*") >= 0 || sjc.indexOf("//") >= 0) {
    console.error("FAIL: comments present:", JSON.stringify(sjc));
    process.exit(1);
}
// Roundtrip: JSON.parse after stripping should succeed.
if (JSON.parse(sjc).a !== 1) { console.error("FAIL: round-trip a:1"); process.exit(1); }
console.log("ok: strip-json-comments");

// repeat-string.
eq(repeatString("ab", 3), "ababab", "repeat");
eq(repeatString("-", 5), "-----", "dash x5");
console.log("ok: repeat-string");

// title-case.
eq(titleCase("the quick brown fox"), "The Quick Brown Fox", "TitleCase");
console.log("ok: title-case");

console.log("\nsmall_utils smoke: all assertions passed");
