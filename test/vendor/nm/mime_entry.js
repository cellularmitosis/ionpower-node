var mime = require("mime-types");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(mime.lookup("index.html") === "text/html",       "index.html");
assert(mime.lookup(".json")       === "application/json", ".json");
assert(mime.lookup("foo.tar.gz")  === "application/gzip", "foo.tar.gz");
assert(mime.lookup("readme.md")   === "text/markdown",    "readme.md");
assert(mime.lookup("a.unknownext") === false,             "unknown returns false");

assert(mime.extension("text/html") === "html",            "html extension");
assert(mime.extension("application/json") === "json",     "json extension");

assert(mime.contentType("index.html").indexOf("charset=utf-8") > 0,
       "contentType adds charset for text/html");

assert(typeof mime.charset("text/html") === "string",     "charset returns string");
assert(mime.charset("image/png") === false,               "charset false for binary");

console.log("ok: lookup (5), extension (2), contentType + charset");
console.log("\nmime-types smoke: all assertions passed");
