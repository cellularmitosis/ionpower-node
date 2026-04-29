// End-to-end reference client for the paste server. POSTs a text
// payload, captures { url, token }, GETs it back with the bearer,
// verifies the plaintext round-trips, and confirms an unauthorized
// GET is rejected. Runs on the same host as the server (talks to
// 127.0.0.1).
//
// Usage: ./node demos/paste/client.js [url]
//   default url: http://127.0.0.1:8090

var URL = process.argv[2] || "http://127.0.0.1:8090";

var TEST_TEXT = "hello from the paste demo on a 1999 G3.\n" +
                "this round-trips through:\n" +
                "  AES-256-GCM (96-bit IV, 128-bit auth tag)\n" +
                "  zlib.gzipSync (real DEFLATE via /usr/bin/gzip)\n" +
                "  fs.writeFileSync\n" +
                "  ECDSA P-256 sign over { id, exp } (ES256 JWT)\n" +
                "  -- back to the client --\n" +
                "  ECDSA verify -> gunzip -> AES-GCM decrypt\n";

console.log("=== POST /paste ===");
console.log("input:  " + TEST_TEXT.length + " bytes");

var t0 = Date.now();
fetch(URL + "/paste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: TEST_TEXT })
}).then(function (r) {
    if (!r.ok) { return r.json().then(function (j) { throw new Error("HTTP " + r.status + ": " + j.error); }); }
    return r.json();
}).then(function (j) {
    console.log("post took:    " + (Date.now() - t0) + " ms");
    console.log("url:          " + j.url);
    console.log("stored:       " + j.stored + " bytes (" + j.compressionPct + "% saved)");
    console.log("token:        " + j.token.slice(0, 50) + "...");
    console.log("");

    console.log("=== GET " + j.url + " ===");
    var t1 = Date.now();
    return fetch(URL + j.url, {
        headers: { "Authorization": "Bearer " + j.token }
    }).then(function (r) {
        return r.json().then(function (body) { return { status: r.status, body: body, ms: Date.now() - t1 }; });
    });
}).then(function (out) {
    console.log("get took:     " + out.ms + " ms");
    console.log("status:       " + out.status);
    if (out.status !== 200) {
        console.error("FAIL: " + JSON.stringify(out.body));
        process.exit(1);
    }
    if (out.body.text !== TEST_TEXT) {
        console.error("FAIL: round-trip mismatch");
        console.error("got:      " + JSON.stringify(out.body.text.slice(0, 80)));
        console.error("expected: " + JSON.stringify(TEST_TEXT.slice(0, 80)));
        process.exit(1);
    }
    console.log("ok: round-trip identity (" + out.body.text.length + " bytes)");

    console.log("");
    console.log("=== unauthorized GET (no bearer) ===");
    var url = out.body.id ? "/paste/" + out.body.id : null;
    if (!url) { console.log("(skip: no id in response)"); return; }
    return fetch(URL + url).then(function (r) {
        if (r.status === 401) {
            console.log("ok: rejected (HTTP 401) without bearer");
        } else {
            console.error("FAIL: expected 401, got " + r.status);
            process.exit(1);
        }
    });
}).then(function () {
    console.log("\npaste round-trip smoke: ok");
    process.exit(0);
}).catch(function (e) {
    console.error("FAIL:", e && e.message);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
});
