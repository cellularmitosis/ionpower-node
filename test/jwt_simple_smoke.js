// jwt-simple: minimal JWT encode/decode (alt to jsonwebtoken).

var jwt = require("./vendor/jwt-simple.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var secret = "ionpower-test";
var payload = { sub: "macuser", role: "admin" };

var tok = jwt.encode(payload, secret, "HS256");
assert(typeof tok === "string" && tok.split(".").length === 3, "3-part token");
console.log("ok: encode");

var back = jwt.decode(tok, secret);
assert(back.sub === "macuser" && back.role === "admin", "decode round-trip");
console.log("ok: decode");

// Wrong secret.
var rejected = false;
try { jwt.decode(tok, "wrong"); } catch (e) { rejected = true; }
assert(rejected, "wrong secret rejected");
console.log("ok: wrong secret");

console.log("\njwt-simple smoke: all assertions passed");
