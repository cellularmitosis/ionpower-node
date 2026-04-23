// oauth-sign: OAuth 1.0a signature helpers. Uses our crypto.createHmac.

var oauth = require("./vendor/oauth-sign.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Our crypto only shipped HMAC-SHA256. Call the SHA-256 variant explicitly
// (hmacsign is SHA-1 and would fail).
var sig = oauth.hmacsign256("GET", "https://api.example.com/", {
    oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
    oauth_nonce:        "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp:    "1318622958",
    oauth_token:        "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    oauth_version:      "1.0"
}, "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kENg");

assert(typeof sig === "string" && sig.length > 10, "signature produced: " + sig);
console.log("ok: hmacsign256:", sig.slice(0, 30) + "...");

// Plain-text signing.
var psig = oauth.plaintext("consumer-secret", "token-secret");
assert(psig === "consumer-secret&token-secret", "plaintext: " + psig);
console.log("ok: plaintext");

console.log("\noauth-sign smoke: all assertions passed");
