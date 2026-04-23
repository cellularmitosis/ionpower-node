// valid-url: RFC 3986 URI validation.

var vu = require("./vendor/valid-url.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// isUri: any URI (scheme required).
assert(vu.isUri("https://example.com"),    "https is URI");
assert(vu.isUri("ftp://x.com/y"),          "ftp is URI");
assert(!vu.isUri("not a uri"),             "plain text not URI");
console.log("ok: valid-url.isUri");

// isHttpUri / isHttpsUri.
assert(vu.isHttpUri("http://example.com"),     "http match");
assert(!vu.isHttpUri("https://example.com"),   "http not https");
assert(vu.isHttpsUri("https://example.com"),   "https match");
console.log("ok: valid-url.isHttpUri + isHttpsUri");

console.log("\nvalid-url smoke: all assertions passed");
