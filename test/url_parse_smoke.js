// url-parse: browser-compatible URL parser (with querystringify +
// requires-port as deps — both vendored alongside).

var URL = require("./vendor/url-parse.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

var u = new URL("https://macuser:passwd@example.com:8443/path/to/thing?q=1&r=2#frag");
eq(u.protocol, "https:", "protocol");
eq(u.hostname, "example.com", "hostname");
eq(u.port, "8443", "port");
eq(u.pathname, "/path/to/thing", "pathname");
eq(u.query, "?q=1&r=2", "query");
eq(u.hash, "#frag", "hash");
eq(u.auth, "macuser:passwd", "auth");
console.log("ok: parse all components");

// Parse query string.
var u2 = new URL("https://example.com/?a=1&b=hello", true);
eq(u2.query.a, "1", "query.a");
eq(u2.query.b, "hello", "query.b");
console.log("ok: parsed query object");

// Build via toString.
var s = u.toString();
assert(s.indexOf("https://macuser:passwd@example.com:8443") === 0,
       "toString roundtrip starts with full auth+host+port");
console.log("ok: toString roundtrip");

console.log("\nurl-parse smoke: all assertions passed");
