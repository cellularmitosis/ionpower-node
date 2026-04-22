// escape-html: tiny HTML-entity escaper.

var escapeHtml = require("./vendor/escape-html.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(escapeHtml("hi"), "hi", "plain");
eq(escapeHtml("<b>bold</b>"), "&lt;b&gt;bold&lt;/b&gt;", "tags");
eq(escapeHtml('"hello & world"'), "&quot;hello &amp; world&quot;", "quotes + amp");
eq(escapeHtml("a'b"), "a&#39;b", "single quote");
console.log("ok: 4 escape-html forms");

console.log("\nescape-html smoke: all assertions passed");
