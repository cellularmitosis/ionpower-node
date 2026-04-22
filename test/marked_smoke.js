// Smoke test: run `marked` (v4.3.0, zero-dep pure-JS markdown parser)
// through ionpower-node and verify it produces the expected HTML.

const marked = require("./vendor/marked.js");

// Marked v4 exports: parse, parseInline, ... We call parse() on a small
// document and check the output shape.
const md = [
    "# Hello, PowerPC",
    "",
    "This is *italic* and **bold** and `code`.",
    "",
    "- item one",
    "- item two",
    "",
    "> a blockquote",
    "",
    "```js",
    "console.log('hi');",
    "```",
    ""
].join("\n");

const html = marked.parse(md);
console.log(html);

// Cheap assertions to ensure the parse ran:
function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}
assert(html.indexOf("<h1") === 0 ||
       html.indexOf('<h1 id="hello-powerpc"') >= 0, "h1 rendered");
assert(html.indexOf("<em>italic</em>")  >= 0, "em rendered");
assert(html.indexOf("<strong>bold</strong>") >= 0, "strong rendered");
assert(html.indexOf("<code>code</code>") >= 0, "inline code rendered");
assert(html.indexOf("<ul>") >= 0,              "list rendered");
assert(html.indexOf("<blockquote>") >= 0,      "blockquote rendered");
assert(html.indexOf("<pre>") >= 0,             "code fence rendered");

console.log("\nmarked smoke: all assertions passed");
