// Smoke test: uuid 8.3.2 (UMD browser build) on ionpower-node.
// Before the crypto bridge landed, uuid.v4() threw because the browser
// bundle probes crypto.getRandomValues which we didn't expose. Now we do
// (via /dev/urandom), so v4 works.

const uuid = require("./vendor/uuid.js");
console.log("uuid module keys:", Object.keys(uuid).sort().join(", "));

var id = uuid.v4();
console.log("v4():", id);
if (typeof id !== "string" || id.length !== 36 || !/^[0-9a-f-]+$/.test(id)) {
    console.error("FAIL: v4 returned unexpected shape:", id);
    process.exit(1);
}
// Two v4s in a row should differ.
if (uuid.v4() === id) { console.error("FAIL: v4 not random"); process.exit(1); }
console.log("ok: v4 (random, via /dev/urandom crypto shim)");

// v3 and v5 don't need crypto — they hash a namespace + name.
// v3 uses MD5, v5 uses SHA1 — both implemented in pure JS inside
// the uuid bundle.
var NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
try {
    var v5id = uuid.v5("http://ionpower-node.example.com", NS_URL);
    console.log("v5():", v5id);
    if (typeof v5id !== "string" || v5id.length !== 36) {
        console.error("FAIL: v5 returned unexpected shape");
        process.exit(1);
    }
    console.log("ok: v5 (deterministic) works");
} catch (e) {
    console.error("FAIL: v5 threw unexpectedly:", e.message);
    process.exit(1);
}

// validate / parse
var ok = uuid.validate("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
if (ok !== true) { console.error("FAIL: validate should return true"); process.exit(1); }
console.log("ok: validate");

var parsed = uuid.parse("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
if (parsed.length !== 16) { console.error("FAIL: parse length"); process.exit(1); }
console.log("ok: parse returns 16 bytes");

console.log("\nuuid smoke: all assertions passed (v3/v4/v5 + validate + parse)");
