// Smoke test: showdown 2.1 (markdown parser, companion to marked) on
// ionpower-node.
var showdown = require("./vendor/showdown.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var converter = new showdown.Converter();
var md = [
    "# Hello",
    "",
    "This is *italic* and **bold**.",
    "",
    "- one",
    "- two",
    "",
    "```js",
    "f()",
    "```",
].join("\n");

var html = converter.makeHtml(md);
console.log(html);
assert(html.indexOf("<h1") === 0, "h1 at start");
assert(html.indexOf("<em>italic</em>") >= 0, "em");
assert(html.indexOf("<strong>bold</strong>") >= 0, "strong");
assert(html.indexOf("<ul>") >= 0, "list");
assert(html.indexOf("<pre>") >= 0 || html.indexOf("<code") >= 0, "code fence");

// makeMarkdown is available as a method but internally touches `window`
// (DOM) so it's unusable on server-side runtimes without a DOM shim.
// Document that instead of calling it.
console.log("note: showdown.makeMarkdown requires a DOM (`window`) — skipped");

console.log("\nshowdown smoke: all assertions passed");
