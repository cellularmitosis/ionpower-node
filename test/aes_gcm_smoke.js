// AES-GCM NIST test vector + round-trip with AAD + tag-mismatch rejection.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "\n    got     ", a, "\n    expected", b); process.exit(1); }
}
function hex(h) {
    h = h.replace(/\s+/g, "");
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i/2] = parseInt(h.substr(i, 2), 16);
    return Buffer.from(out);
}

// --- NIST Test Case 3 (simplified for brevity) ---
// AES-128-GCM, K = 00*16, IV = 00*12, P = 00*16, A = empty
// Expected C = 0388dace60b6a392f328c2b971b2fe78, T = ab6e47d42cec13bdf53a67b21257bddf
var key = hex("00000000000000000000000000000000");
var iv  = hex("000000000000000000000000");
var pt  = hex("00000000000000000000000000000000");
var c = crypto.createCipheriv("aes-128-gcm", key, iv);
c.update(pt);
var ct = c["final"]();
var tag = c.getAuthTag();
eq(ct.toString("hex"), "0388dace60b6a392f328c2b971b2fe78",
   "NIST GCM Test 3 ciphertext");
eq(tag.toString("hex"), "ab6e47d42cec13bdf53a67b21257bddf",
   "NIST GCM Test 3 authTag");
console.log("ok: NIST AES-128-GCM Test Case 3");

// --- Round-trip with AAD ---
var key2 = crypto.randomBytes(32);
var iv2  = crypto.randomBytes(12);
var msg  = "Sensitive payload: account balance = $12,345.67";
var aad  = "userId=alice";
var enc = crypto.createCipheriv("aes-256-gcm", key2, iv2);
enc.setAAD(Buffer.from(aad));
enc.update(msg);
var ciphered = enc["final"]();
var authTag = enc.getAuthTag();
assert(authTag.length === 16, "getAuthTag length 16");

var dec = crypto.createDecipheriv("aes-256-gcm", key2, iv2);
dec.setAAD(Buffer.from(aad));
dec.setAuthTag(authTag);
dec.update(ciphered);
var decoded = dec["final"]("utf8");
eq(decoded, msg, "AES-256-GCM round-trip with AAD");
console.log("ok: AES-256-GCM round-trip with AAD");

// --- Tag mismatch rejection ---
var badTag = Buffer.from(authTag); badTag[0] ^= 0xff;
var dec2 = crypto.createDecipheriv("aes-256-gcm", key2, iv2);
dec2.setAAD(Buffer.from(aad));
dec2.setAuthTag(badTag);
dec2.update(ciphered);
var threw = false;
try { dec2["final"](); } catch (e) { threw = true; }
assert(threw, "GCM rejects bad authTag");
console.log("ok: GCM rejects bad authTag");

// --- Wrong AAD rejection ---
var dec3 = crypto.createDecipheriv("aes-256-gcm", key2, iv2);
dec3.setAAD(Buffer.from("userId=mallory"));
dec3.setAuthTag(authTag);
dec3.update(ciphered);
var threw3 = false;
try { dec3["final"](); } catch (e) { threw3 = true; }
assert(threw3, "GCM rejects wrong AAD");
console.log("ok: GCM rejects wrong AAD");

console.log("\naes_gcm smoke: all assertions passed");
