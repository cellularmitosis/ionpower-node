// diff2html: render unified-diff strings as HTML.

var Diff2Html = require("./vendor/diff2html.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var unified = [
    "--- a/file.txt",
    "+++ b/file.txt",
    "@@ -1,3 +1,3 @@",
    " context line",
    "-removed line",
    "+added line",
    " more context"
].join("\n");

var parsed = Diff2Html.parse(unified);
assert(Array.isArray(parsed), "parsed is array");
assert(parsed.length === 1, "one file");
console.log("ok: parse");

var html = Diff2Html.html(unified, { outputFormat: "line-by-line" });
assert(html.indexOf("<") >= 0 && html.length > 100, "html produced: " + html.length + " bytes");
// Check the file header is there; inline diffs may highlight words letter-by-letter.
assert(html.indexOf("file.txt") >= 0, "filename in output");
console.log("ok: html rendered " + html.length + " bytes");

console.log("\ndiff2html smoke: all assertions passed");
