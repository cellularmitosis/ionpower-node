// escape-latex: escape special chars for LaTeX output (math/text modes).

var escapeLatex = require("./vendor/escape-latex.js");
escapeLatex = escapeLatex.default || escapeLatex;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// The five "always" specials: # $ % & _
var out1 = escapeLatex("price: $10 & tax 5%");
assert(out1.indexOf("\\$") !== -1, "$ escaped: " + out1);
assert(out1.indexOf("\\&") !== -1, "& escaped: " + out1);
assert(out1.indexOf("\\%") !== -1, "% escaped: " + out1);
console.log("ok: escape-latex: $, &, %");

var out2 = escapeLatex("file_name # comment");
assert(out2.indexOf("\\_") !== -1, "_ escaped: " + out2);
assert(out2.indexOf("\\#") !== -1, "# escaped: " + out2);
console.log("ok: escape-latex: _ and #");

// Plain text passes through.
assert(escapeLatex("hello world") === "hello world", "plain passes");
console.log("ok: escape-latex: ASCII passes through");

console.log("\nescape-latex smoke: all assertions passed");
