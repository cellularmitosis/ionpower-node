// zlib compression (stored mode): deflate / gzip / deflateRaw +
// round-trip via our existing inflate. Output is valid deflate that
// any RFC 1951 decoder will consume — no compression ratio, just
// frame correctness.

var zlib = require("zlib");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var msg = "The quick brown fox jumps over the lazy dog.\n";
var bytes = Buffer.from(msg);

// --- deflateRawSync → inflateRawSync round-trip ---
var raw = zlib.deflateRawSync(bytes);
assert(raw instanceof Buffer || raw instanceof Uint8Array, "deflateRaw returns Buffer");
assert(raw.length >= bytes.length + 5, "stored-mode adds 5+ bytes overhead");
var rawRound = zlib.inflateRawSync(raw).toString("utf8");
assert(rawRound === msg, "deflateRaw → inflateRaw round-trip: " + JSON.stringify(rawRound));
console.log("ok: deflateRaw → inflateRaw round-trip");

// --- deflateSync → inflateSync (zlib-wrapped) ---
var z = zlib.deflateSync(bytes);
assert(z[0] === 0x78, "zlib CMF byte");
var zRound = zlib.inflateSync(z).toString("utf8");
assert(zRound === msg, "deflate → inflate round-trip: " + JSON.stringify(zRound));
console.log("ok: deflate → inflate round-trip");

// --- gzipSync → gunzipSync ---
var g = zlib.gzipSync(bytes);
assert(g[0] === 0x1f && g[1] === 0x8b, "gzip magic");
assert(g[2] === 0x08, "gzip CM=8 (deflate)");
var gRound = zlib.gunzipSync(g).toString("utf8");
assert(gRound === msg, "gzip → gunzip round-trip: " + JSON.stringify(gRound));
console.log("ok: gzip → gunzip round-trip");

// --- Large input (>64KB) splits into multiple stored blocks ---
var bigStr = "x".repeat(100000);
var bigBuf = Buffer.from(bigStr);
var bigGz  = zlib.gzipSync(bigBuf);
var bigRound = zlib.gunzipSync(bigGz).toString("utf8");
assert(bigRound.length === 100000, "100k gzip round-trip length");
assert(bigRound === bigStr, "100k gzip round-trip content");
console.log("ok: >64KB splits into multi-block stored deflate");

// --- Empty input ---
var empty = zlib.gzipSync(Buffer.alloc(0));
assert(empty.length > 10, "empty gzip has header + empty block + trailer");
assert(zlib.gunzipSync(empty).length === 0, "empty gzip round-trip");
console.log("ok: empty input handled");

// --- Streaming createGzip + createGunzip ---
var gzStream = zlib.createGzip();
var gzBytes = null;
gzStream.on("data", function (c) { gzBytes = c; });
var gzEnded = false;
gzStream.on("end", function () { gzEnded = true; });
gzStream.end("streaming gz test");

// --- crc32 + adler32 consistency: run pipe through other side ---
var deflateStreamOk = null;
var ds = zlib.createDeflate();
var deflated = null;
ds.on("data", function (c) { deflated = c; });
ds.on("end", function () { deflateStreamOk = true; });
ds.end("deflate stream test");

process.on("exit", function () {
    assert(gzEnded, "createGzip 'end' fired");
    assert(gzBytes && gzBytes[0] === 0x1f, "gzip stream produced gzip bytes");
    var recovered = zlib.gunzipSync(gzBytes).toString("utf8");
    assert(recovered === "streaming gz test", "streaming gzip round-trip: " + JSON.stringify(recovered));
    console.log("ok: createGzip Transform");

    assert(deflateStreamOk, "createDeflate 'end' fired");
    var dsRecovered = zlib.inflateSync(deflated).toString("utf8");
    assert(dsRecovered === "deflate stream test", "createDeflate round-trip");
    console.log("ok: createDeflate Transform");

    console.log("\nzlib_deflate smoke: all assertions passed");
});
