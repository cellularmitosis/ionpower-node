// is-url: URL validator.

var isUrl = require("./vendor/is-url.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(isUrl("http://example.com"),                        true,  "http");
eq(isUrl("https://example.com:443/path?q=1"),          true,  "https full");
eq(isUrl("not-a-url"),                                 false, "bare word");
eq(isUrl("ftp://example.com/x"),                       true,  "ftp");
eq(isUrl(""),                                          false, "empty");
console.log("ok: 5 is-url forms");

console.log("\nis-url smoke: all assertions passed");
