// fetch() over HTTPS with a binary body. Up to v0.72 the curl-shim
// HTTPS path tried to UTF-8 decode the body and the failed decode
// poisoned the JS context, leaving response.bodyBytes unset.
//
// v0.73 clears the pending exception so binary fetches work
// end-to-end. We exercise that against a known-binary endpoint
// (a small PNG from npm), and verify the bytes round-trip.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// We need network — skip cleanly if offline. Use the smallest known
// binary asset on a stable URL: an npm package tarball (mri@1.2.0
// is 7193 bytes).
var URL = "https://registry.npmjs.org/mri/-/mri-1.2.0.tgz";

console.log("fetching " + URL);

fetch(URL).then(function (r) {
    assert(r.status === 200, "HTTP 200 (got " + r.status + ")");
    return r.arrayBuffer();
}).then(function (ab) {
    assert(ab instanceof ArrayBuffer, "arrayBuffer() returns ArrayBuffer");
    assert(ab.byteLength > 0, "body has bytes (got " + ab.byteLength + ")");
    var bytes = new Uint8Array(ab);
    // gzip magic bytes
    assert(bytes[0] === 0x1f && bytes[1] === 0x8b, "gzip magic 1f 8b at start");
    assert(bytes[2] === 0x08, "deflate compression method");
    console.log("ok: fetched " + bytes.length + " bytes; gzip header intact");

    // Now decompress with our zlib.gunzipSync to prove the bytes
    // are real and not corrupted.
    var zlib = require("zlib");
    var tar = zlib.gunzipSync(Buffer.from(bytes));
    assert(tar.length > 0, "gunzip produced output");
    // First 100 bytes of a tar are the filename of the first entry.
    // Should be ASCII like 'package/...'.
    var firstName = tar.slice(0, 100).toString("utf8").replace(/\0.*/, "");
    assert(firstName.indexOf("package/") === 0, "first tar entry is package/* (got " + JSON.stringify(firstName) + ")");
    console.log("ok: gunzipped " + tar.length + " bytes, first entry: " + firstName);

    console.log("\nfetch_binary smoke: all assertions passed");
}).catch(function (e) {
    var msg = (e && e.message) || String(e);
    if (/network|getaddrinfo|connect|timeout|EHOSTUNREACH|EAI_AGAIN/i.test(msg)) {
        console.log("skip: offline or unreachable (" + msg + ")");
        return;
    }
    console.error("FAIL:", msg);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
});
