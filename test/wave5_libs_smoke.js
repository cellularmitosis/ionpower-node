// Wave 5 new libs: filter-obj, is-relative-url, titleize.
// Small additions enabled by the full url/querystring/util surface
// landing in waves 1-4.

var filterObj      = require("./vendor/filter-obj.js");
var isRelativeUrl  = require("./vendor/is-relative-url.js");
var titleize       = require("./vendor/titleize.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// filter-obj — keep only keys matching predicate or allowlist.
eq(filterObj({ a: 1, b: 2, c: 3 }, ["a", "c"]),
   { a: 1, c: 3 },
   "filter-obj array predicate");
eq(filterObj({ a: 1, b: 2, c: 3 }, function (k, v) { return v > 1; }),
   { b: 2, c: 3 },
   "filter-obj function predicate");
console.log("ok: filter-obj");

// is-relative-url — inverse of is-absolute-url.
assert(isRelativeUrl("/foo"),            "leading slash");
assert(isRelativeUrl("foo/bar"),         "bare path");
assert(!isRelativeUrl("https://a.com/"), "absolute rejected");
assert(!isRelativeUrl("ftp://host"),     "ftp absolute");
console.log("ok: is-relative-url");

// titleize — lowercase then capitalize.
eq(titleize("the quick brown fox"),       "The Quick Brown Fox", "titleize basic");
eq(titleize("HELLO WORLD"),               "Hello World",         "titleize uppers");
eq(titleize("foo-bar baz"),               "Foo-Bar Baz",         "titleize dashed");
console.log("ok: titleize");

console.log("\nwave5_libs smoke: all assertions passed");
