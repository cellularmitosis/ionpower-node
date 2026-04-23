// jwt-decode: decode a JWT without verification.

var decode = require("./vendor/jwt-decode.js");
decode = decode.default || decode.jwt_decode || decode;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// A token with payload { sub: "abc", name: "Alice" } — arbitrary signature.
// Built with HMAC-SHA256 but decode only needs base64 parsing.
var t = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        ".eyJzdWIiOiJhYmMiLCJuYW1lIjoiQWxpY2UifQ" +
        ".sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
var p = decode(t);
assert(p.sub === "abc", "sub: " + p.sub);
assert(p.name === "Alice", "name: " + p.name);
console.log("ok: payload decoded");

// Header.
var h = decode(t, { header: true });
assert(h.alg === "HS256", "alg HS256: " + h.alg);
console.log("ok: header decoded");

console.log("\njwt-decode smoke: all assertions passed");
