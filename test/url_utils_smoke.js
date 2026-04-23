// is-absolute-url: URL-level helper. normalize-url is vendored too but
// depends on the WHATWG URL constructor which SM45 doesn't ship — we
// leave it in the tree for later (once a URL polyfill lands) without
// a smoke test for now.

var isAbsoluteUrlMod = require("./vendor/is-absolute-url.js");
var isAbsoluteUrl = isAbsoluteUrlMod.default || isAbsoluteUrlMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(isAbsoluteUrl("https://example.com") === true, "https abs");
assert(isAbsoluteUrl("http://example.com/path") === true, "http abs");
assert(isAbsoluteUrl("ftp://files.example.com") === true, "ftp abs");
assert(isAbsoluteUrl("/relative/path") === false, "path not abs");
assert(isAbsoluteUrl("../up") === false, "relative not abs");
assert(isAbsoluteUrl("c:\\Windows") === false, "Windows path not abs url");
console.log("ok: is-absolute-url (6 cases)");

console.log("\nurl_utils smoke: all assertions passed");
