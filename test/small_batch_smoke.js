// A grab-bag of tiny single-file utilities:
//   to-fast-properties, decamelize, trim-newlines, escape-goat, rechoir.

var toFastProps = require("./vendor/to-fast-properties.js");
var decamelize  = require("./vendor/decamelize.js");
var trimNewlines = require("./vendor/trim-newlines.js");
var escapeGoat  = require("./vendor/escape-goat.js");

toFastProps = toFastProps.default || toFastProps;
decamelize  = decamelize.default || decamelize;
trimNewlines = trimNewlines.default || trimNewlines;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}
function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// to-fast-properties: just verify it's a callable + doesn't crash.
var obj = { a: 1, b: 2 };
toFastProps(obj);
assert(obj.a === 1 && obj.b === 2, "toFastProps preserves props");
console.log("ok: to-fast-properties");

// decamelize: "unicornRainbow" -> "unicorn_rainbow"
eq(decamelize("unicornRainbow"), "unicorn_rainbow", "camel->snake");
eq(decamelize("unicornRainbow", "-"), "unicorn-rainbow", "with separator");
console.log("ok: decamelize");

// trim-newlines.
eq(trimNewlines("\n\nhi\n\n"), "hi", "trim newlines");
console.log("ok: trim-newlines");

// escape-goat.
assert(typeof escapeGoat.htmlEscape === "function", "htmlEscape function");
eq(escapeGoat.htmlEscape("<script>"), "&lt;script&gt;", "htmlEscape");
eq(escapeGoat.htmlUnescape("&lt;a&gt;"), "<a>", "htmlUnescape");
console.log("ok: escape-goat");

console.log("\nsmall_batch smoke: all assertions passed");
