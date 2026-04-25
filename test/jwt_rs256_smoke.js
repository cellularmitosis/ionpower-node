// JWT smoke: prove the runtime can produce + verify RS256 and EdDSA
// JWTs using only crypto APIs (no JWT library). This exercises the
// asymmetric crypto stack added in v0.65-v0.67 (RSA via forge,
// Ed25519 via tweetnacl, X.509-shaped KeyObject, PEM import).

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

function b64urlEncode(buf) {
    if (typeof buf === "string") buf = Buffer.from(buf, "utf8");
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64");
}

function jwtSign(header, payload, key, signFn) {
    var h = b64urlEncode(JSON.stringify(header));
    var p = b64urlEncode(JSON.stringify(payload));
    var data = h + "." + p;
    var sig = signFn(Buffer.from(data, "utf8"), key);
    return data + "." + b64urlEncode(sig);
}
function jwtVerify(token, key, verifyFn) {
    var parts = token.split(".");
    if (parts.length !== 3) return null;
    var data = parts[0] + "." + parts[1];
    var sig  = b64urlDecode(parts[2]);
    if (!verifyFn(Buffer.from(data, "utf8"), key, sig)) return null;
    var hdr = JSON.parse(b64urlDecode(parts[0]).toString("utf8"));
    var payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
    return { header: hdr, payload: payload };
}

console.log("Generating RSA-1024 (slow on PPC)...");
var t0 = Date.now();
var rsaPair = crypto.generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 0x10001 });
console.log("RSA keygen took", Date.now() - t0, "ms");

// ---- RS256 round-trip ----
var rsHeader  = { alg: "RS256", typ: "JWT" };
var rsPayload = { sub: "macuser", iat: 1234567890, role: "admin" };

var rsToken = jwtSign(rsHeader, rsPayload, rsaPair.privateKey, function (data, key) {
    return crypto.sign("sha256", data, key);
});
assert(typeof rsToken === "string" && rsToken.split(".").length === 3, "RS256 token has 3 parts");
console.log("ok: RS256 sign  (" + rsToken.length + " chars)");

var rsBack = jwtVerify(rsToken, rsaPair.publicKey, function (data, key, sig) {
    return crypto.verify("sha256", data, key, sig);
});
assert(rsBack !== null, "RS256 verify ok");
assert(rsBack.payload.sub === "macuser", "RS256 sub round-tripped");
assert(rsBack.payload.role === "admin", "RS256 role round-tripped");
assert(rsBack.header.alg === "RS256", "RS256 alg round-tripped");
console.log("ok: RS256 verify + payload identity");

// ---- RS256 tamper rejected ----
var tampered = rsToken.split(".");
tampered[1] = b64urlEncode(JSON.stringify({ sub: "evil", role: "admin" }));
var tamperedToken = tampered.join(".");
var rsBad = jwtVerify(tamperedToken, rsaPair.publicKey, function (data, key, sig) {
    return crypto.verify("sha256", data, key, sig);
});
assert(rsBad === null, "RS256 tampered payload rejected");
console.log("ok: RS256 tamper rejected");

// ---- RS256 via PEM-imported keys ----
var rsPubPem  = rsaPair.publicKey.export({ format: "pem" });
var rsPrivPem = rsaPair.privateKey.export({ format: "pem" });
var rsPubKO   = crypto.createPublicKey(rsPubPem);
var rsPrivKO  = crypto.createPrivateKey(rsPrivPem);

var rsToken2 = jwtSign(rsHeader, rsPayload, rsPrivKO, function (data, key) {
    return crypto.sign("sha256", data, key);
});
var rsBack2 = jwtVerify(rsToken2, rsPubKO, function (data, key, sig) {
    return crypto.verify("sha256", data, key, sig);
});
assert(rsBack2 !== null, "RS256 verify with PEM-imported keys");
assert(rsBack2.payload.sub === "macuser", "RS256 PEM round-trip identity");
console.log("ok: RS256 with PEM-imported keys");

// ---- EdDSA (Ed25519) round-trip ----
var edPair = crypto.generateKeyPairSync("ed25519");
var edHeader  = { alg: "EdDSA", typ: "JWT" };
var edPayload = { sub: "macuser", iss: "ionpower-node-test" };

var edToken = jwtSign(edHeader, edPayload, edPair.privateKey, function (data, key) {
    return crypto.sign(null, data, key);
});
assert(edToken.split(".").length === 3, "EdDSA token has 3 parts");
console.log("ok: EdDSA sign  (" + edToken.length + " chars)");

var edBack = jwtVerify(edToken, edPair.publicKey, function (data, key, sig) {
    return crypto.verify(null, data, key, sig);
});
assert(edBack !== null, "EdDSA verify ok");
assert(edBack.payload.sub === "macuser", "EdDSA payload round-trip");
assert(edBack.header.alg === "EdDSA", "EdDSA alg round-trip");
console.log("ok: EdDSA verify + payload identity");

// ---- EdDSA tamper rejected ----
var edTampered = edToken.split(".");
edTampered[1] = b64urlEncode(JSON.stringify({ sub: "evil" }));
var edBad = jwtVerify(edTampered.join("."), edPair.publicKey, function (data, key, sig) {
    return crypto.verify(null, data, key, sig);
});
assert(edBad === null, "EdDSA tampered payload rejected");
console.log("ok: EdDSA tamper rejected");

// ---- HS256 (HMAC) for comparison — symmetric path ----
var secret = Buffer.from("super-secret-jwt-key", "utf8");
var hsHeader = { alg: "HS256", typ: "JWT" };
var hsToken = jwtSign(hsHeader, rsPayload, secret, function (data, key) {
    return crypto.createHmac("sha256", key).update(data).digest();
});
var hsBack = jwtVerify(hsToken, secret, function (data, key, sig) {
    var expected = crypto.createHmac("sha256", key).update(data).digest();
    return crypto.timingSafeEqual(expected, sig);
});
assert(hsBack !== null, "HS256 verify");
assert(hsBack.payload.sub === "macuser", "HS256 round-trip");
console.log("ok: HS256 (HMAC sha256)");

// ---- Cross-algorithm reject: RS256 token verified against EdDSA key fails ----
var crossBad = jwtVerify(rsToken, edPair.publicKey, function (data, key, sig) {
    try { return crypto.verify(null, data, key, sig); } catch (e) { return false; }
});
assert(crossBad === null, "RS256 token rejected by EdDSA key");
console.log("ok: cross-algo rejection");

console.log("\njwt_rs256 smoke: all assertions passed");
