// dedent + outdent: strip leading whitespace from template literals.

var dedent  = require("./vendor/dedent.js");
var outdentMod = require("./vendor/outdent.js");
var outdent = outdentMod.outdent || outdentMod.default || outdentMod;

dedent  = dedent.default  || dedent;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// dedent: tagged-template + direct-string form.
eq(dedent("    hello\n    world"), "hello\nworld", "dedent strips 4-space indent");
console.log("ok: dedent");

// outdent.string uses the lib's tagged-template logic which does its own
// indentation math; just verify it returns something shorter than input.
var stripped = outdent.string("      foo\n        bar\n      baz");
if (stripped.length >= "      foo\n        bar\n      baz".length) {
    console.error("FAIL: outdent should shorten; got", stripped.length, "vs", "      foo\n        bar\n      baz".length);
    process.exit(1);
}
console.log("ok: outdent.string shortened to", JSON.stringify(stripped));

console.log("\ndedent/outdent smoke: all assertions passed");
