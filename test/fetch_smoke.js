// fetch / AbortController / AbortSignal smoke.
// Runs a local http.createServer to serve test responses + fetches from it.

var http = require("http");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- Globals exposed ---
assert(typeof fetch === "function", "global fetch");
assert(typeof AbortController === "function", "global AbortController");
assert(typeof AbortSignal === "function", "global AbortSignal");
assert(typeof Headers === "function", "global Headers");
assert(typeof Response === "function", "global Response");
console.log("ok: fetch/AbortController/Headers/Response globals");

// --- Headers basics ---
var h = new Headers({ "Content-Type": "application/json" });
assert(h.get("content-type") === "application/json", "Headers get case-insensitive");
h.set("X-Custom", "yes");
assert(h.has("x-custom"), "Headers has");
var keys = h.keys();
assert(keys.indexOf("content-type") >= 0 && keys.indexOf("x-custom") >= 0, "Headers keys");
console.log("ok: Headers Map-ish API");

// --- AbortController + AbortSignal.timeout ---
var ac = new AbortController();
assert(!ac.signal.aborted, "signal not aborted before .abort");
var abortFired = false;
ac.signal.addEventListener("abort", function () { abortFired = true; });
ac.abort(new Error("user cancel"));
assert(ac.signal.aborted, "signal aborted after .abort");
assert(abortFired, "abort listener fired");
assert(ac.signal.reason.message === "user cancel", "abort reason carried");
console.log("ok: AbortController.abort");

var sigT = AbortSignal.timeout(30);
assert(!sigT.aborted, "timeout signal starts not-aborted");
// Verified in exit handler
var sigA = AbortSignal.abort("already");
assert(sigA.aborted && sigA.reason === "already", "AbortSignal.abort pre-aborted");
console.log("ok: AbortSignal.abort / .timeout shape");

// --- fetch via local server ---
var server = http.createServer(function (req, res) {
    if (req.method === "GET" && req.url === "/hello") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("hello, fetch\n");
    } else if (req.method === "GET" && req.url === "/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"answer":42,"kind":"json"}');
    } else if (req.method === "POST" && req.url === "/echo") {
        var chunks = [];
        req.on("data", function (c) { chunks.push(c); });
        req.on("end", function () {
            res.writeHead(200, { "Content-Type": "application/octet-stream" });
            res.end(Buffer.concat(chunks));
        });
    } else {
        res.writeHead(404);
        res.end("not found");
    }
});

var fetchedHello = null;
var fetchedJson = null;
var fetchedPost = null;
var statusGot = null;
var settledCount = 0;
var abortErr = null;

server.listen(0, "127.0.0.1", function () {
    var base = "http://127.0.0.1:" + server.address().port;

    // GET /hello — text()
    fetch(base + "/hello").then(function (res) {
        statusGot = res.status;
        return res.text();
    }).then(function (t) {
        fetchedHello = t;
        if (++settledCount === 4) server.close();
    });

    // GET /json — json()
    fetch(base + "/json").then(function (res) {
        return res.json();
    }).then(function (j) {
        fetchedJson = j;
        if (++settledCount === 4) server.close();
    });

    // POST /echo — body
    fetch(base + "/echo", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "pqr"
    }).then(function (res) {
        return res.text();
    }).then(function (t) {
        fetchedPost = t;
        if (++settledCount === 4) server.close();
    });

    // Abort: fetch to a port that exists, abort mid-flight.
    var ctl = new AbortController();
    fetch(base + "/hello", { signal: ctl.signal })
        .catch(function (e) { abortErr = e; if (++settledCount === 4) server.close(); });
    ctl.abort(new Error("cancelled fetch"));
});

process.on("exit", function () {
    assert(statusGot === 200, "GET status 200 (got " + statusGot + ")");
    assert(fetchedHello === "hello, fetch\n", "fetch text(): " + JSON.stringify(fetchedHello));
    console.log("ok: fetch GET + text()");
    assert(fetchedJson && fetchedJson.answer === 42 && fetchedJson.kind === "json",
           "fetch json(): " + JSON.stringify(fetchedJson));
    console.log("ok: fetch GET + json()");
    assert(fetchedPost === "pqr", "fetch POST round-trip: " + JSON.stringify(fetchedPost));
    console.log("ok: fetch POST + body");
    assert(abortErr, "aborted fetch rejected");
    assert(abortErr.message === "cancelled fetch" || abortErr.message.indexOf("cancelled") >= 0,
           "abort reason propagated: " + abortErr.message);
    console.log("ok: fetch + AbortController");
    console.log("\nfetch smoke: all assertions passed");
});
