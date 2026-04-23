// escape-string-regexp: escape regex metacharacters in a string so
// you can safely pass user input to `new RegExp(...)`. Commonly
// pulled in by test matchers / ripgrep-style tools.

var esc = require("./vendor/escape-string-regexp.js");
esc = esc.default || esc;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(esc("foo"),      "foo",       "plain chars");
eq(esc("1.2.3"),    "1\\.2\\.3", "dot escaped");
eq(esc("a+b*c"),    "a\\+b\\*c", "+ and * escaped");
eq(esc("(x|y)"),    "\\(x\\|y\\)","parens + pipe escaped");
eq(esc("$HOME"),    "\\$HOME",   "dollar escaped");
eq(esc("^start"),   "\\^start",  "caret escaped");
console.log("ok: escape-string-regexp (6 cases)");

// And verify the result actually works as a regex source.
var pattern = "version = " + esc("1.2.3");
var re = new RegExp(pattern);
if (!re.test("version = 1.2.3")) { console.error("FAIL: escaped regex doesn't match"); process.exit(1); }
if (re.test("version = 1X2Y3"))  { console.error("FAIL: escaped regex matched non-literal"); process.exit(1); }
console.log("ok: escaped regex enforces literal match");

console.log("\nescape-string-regexp smoke: all assertions passed");
