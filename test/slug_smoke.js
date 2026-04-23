// slug: URL-safe slug generator (larger than slugify; unicode-aware).

var slug = require("./vendor/slug.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(slug("Hello, World!"),                          "hello-world", "hello world");
eq(slug("café & crêpes"),                          "cafe-crepes", "accented (default drops &)");
eq(slug("How I 10x'd my productivity"),            "how-i-10xd-my-productivity", "apostrophe");
// Custom lower:false.
eq(slug("Hello World", { lower: false }),          "Hello-World", "preserve case");
console.log("ok: 4 slug forms");

console.log("\nslug smoke: all assertions passed");
