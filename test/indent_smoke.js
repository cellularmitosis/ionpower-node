// strip-indent + redent: indent/dedent string blocks.

var stripIndent = require("./vendor/strip-indent.js");
var redent      = require("./vendor/redent.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(stripIndent("  hello\n  world"), "hello\nworld", "strip 2 spaces");
eq(stripIndent("    foo\n      bar"), "foo\n  bar", "strip relative indent");
console.log("ok: strip-indent");

// redent: strip then re-indent.
eq(redent("  hello\n  world", 4), "    hello\n    world", "redent to 4");
eq(redent("    hello\n    world", 0), "hello\nworld", "redent to 0 == strip");
console.log("ok: redent");

console.log("\nindent smoke: all assertions passed");
