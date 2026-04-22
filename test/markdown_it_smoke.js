// Smoke test: markdown-it 13.x (more extensible markdown parser) on
// ionpower-node. Third markdown engine (after marked and showdown).
var MarkdownIt = require("./vendor/markdown-it.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var md = new MarkdownIt();
var src = [
    "# Hello",
    "",
    "*emph* and **bold** and `code`.",
    "",
    "- one",
    "- two",
    "",
    "```js",
    "f()",
    "```",
].join("\n");

var html = md.render(src);
console.log(html);
assert(html.indexOf("<h1>Hello</h1>") >= 0,          "h1");
assert(html.indexOf("<em>emph</em>") >= 0,           "em");
assert(html.indexOf("<strong>bold</strong>") >= 0,   "strong");
assert(html.indexOf("<code>code</code>") >= 0,       "inline code");
assert(html.indexOf("<ul>") >= 0,                    "list");
assert(html.indexOf("<pre><code class=\"language-js\">") >= 0, "code fence with lang");

// Inline render.
var inline = md.renderInline("**hi** *ppc*");
assert(inline === "<strong>hi</strong> <em>ppc</em>", "renderInline: " + inline);
console.log("ok: renderInline");

console.log("\nmarkdown-it smoke: all assertions passed");
