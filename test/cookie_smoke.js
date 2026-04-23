// cookie: parse + serialize Set-Cookie headers.

var cookie = require("./vendor/cookie.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Parse.
var p = cookie.parse("a=1; b=hello%20world; c=");
eq(p.a, "1", "cookie.a");
eq(p.b, "hello world", "cookie.b URL decoded");
eq(p.c, "", "cookie.c empty");
console.log("ok: parse");

// Serialize.
eq(cookie.serialize("k", "v"), "k=v", "serialize simple");
var s = cookie.serialize("sess", "abc", { httpOnly: true, maxAge: 60, path: "/" });
assert(s.indexOf("sess=abc") === 0, "starts with sess=abc");
assert(s.indexOf("HttpOnly") >= 0, "HttpOnly flag");
assert(s.indexOf("Max-Age=60") >= 0, "Max-Age=60");
assert(s.indexOf("Path=/") >= 0, "Path=/");
console.log("ok: serialize with options:", s);

console.log("\ncookie smoke: all assertions passed");
