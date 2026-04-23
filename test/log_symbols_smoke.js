// log-symbols: ✔ ✖ ⚠ ℹ (with color via chalk).

var logSymbols = require("./vendor/log-symbols.js");
logSymbols = logSymbols.default || logSymbols;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Strip any ANSI wrapper to check the underlying glyph.
var stripAnsi = require("./vendor/strip-ansi.js");

["info", "success", "warning", "error"].forEach(function (name) {
    var sym = logSymbols[name];
    assert(typeof sym === "string", name + " is a string");
    assert(sym.length > 0, name + " non-empty");
    var stripped = stripAnsi(sym);
    assert(stripped.length > 0, name + " has a visible glyph");
    console.log("ok: log-symbols." + name + " = " + JSON.stringify(sym));
});

console.log("\nlog-symbols smoke: all assertions passed");
