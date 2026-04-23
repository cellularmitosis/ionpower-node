// jsonwebtoken: JWT sign + verify with HMAC-SHA256. Requires a full node
// crypto with createHmac, which we need to provide alongside Buffer.

var jwt = require("jsonwebtoken");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var secret = "ionpower-test-secret";

// Sign.
var token = jwt.sign(
    { sub: "macuser", role: "admin" },
    secret,
    { algorithm: "HS256", expiresIn: "1h" }
);
assert(typeof token === "string" && token.split(".").length === 3,
       "jwt has 3 dots: " + token);
console.log("ok: signed HS256 token: " + token.slice(0, 40) + "...");

// Verify.
var decoded = jwt.verify(token, secret);
assert(decoded.sub === "macuser", "sub: " + decoded.sub);
assert(decoded.role === "admin",  "role: " + decoded.role);
assert(typeof decoded.exp === "number", "exp is number");
console.log("ok: verified; payload.sub=" + decoded.sub);

// Wrong secret.
var rejected = false;
try {
    jwt.verify(token, "wrong-secret");
} catch (e) {
    rejected = true;
}
assert(rejected, "wrong secret should reject");
console.log("ok: wrong secret rejected");

console.log("\njsonwebtoken smoke: all assertions passed");
