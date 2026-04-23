// htmlescape: escape JSON for inline <script> embedding.

var htmlescape = require("./vendor/htmlescape.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Basic.
eq(htmlescape({a: 1}), '{"a":1}', "plain");
// < and > replaced with unicode escapes (lowercase) to survive inline <script>.
eq(htmlescape({tag: "<script>"}), '{"tag":"\\u003cscript\\u003e"}', "script tag");
eq(htmlescape({amp: "a & b"}), '{"amp":"a \\u0026 b"}', "ampersand");
eq(htmlescape({sep: "\u2028"}), '{"sep":"\\u2028"}', "line separator");
console.log("ok: 4 htmlescape forms");

console.log("\nhtmlescape smoke: all assertions passed");
