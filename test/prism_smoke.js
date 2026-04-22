// Smoke test: Prism.js (syntax highlighter) on ionpower-node.
var Prism = require("./vendor/prism.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Prism core ships with markup, css, clike, and javascript language grammars.
// Make sure they're all there.
assert(Prism.languages.markup,     "markup grammar");
assert(Prism.languages.css,        "css grammar");
assert(Prism.languages.clike,      "clike grammar");
assert(Prism.languages.javascript, "javascript grammar");

// Highlight a snippet.
var code = "function greet(name) { return 'hello, ' + name; }";
var html = Prism.highlight(code, Prism.languages.javascript, "javascript");
console.log("highlighted:", html);
assert(html.indexOf("<span") >= 0, "produced spans");
assert(html.indexOf("token") >= 0, "has token classes");
console.log("ok: js highlighting");

// CSS.
var css = "body { color: red; }";
var cssHtml = Prism.highlight(css, Prism.languages.css, "css");
console.log("css highlighted:", cssHtml);
assert(cssHtml.indexOf("<span") >= 0, "css spans");

console.log("\nprismjs smoke: all assertions passed");
