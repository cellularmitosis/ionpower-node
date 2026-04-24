// zlib.inflateSync / gunzipSync / inflateRawSync round-trip via known
// RFC test vectors. Compression stubs still throw.

var zlib = require("zlib");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function hexToBuf(h) {
    h = h.replace(/\s+/g, "");
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i/2] = parseInt(h.substr(i, 2), 16);
    return Buffer.from(out);
}

// --- gunzipSync ---
// Generated via `echo "Hello, world!" | perl -MCompress::Zlib -e '...'`.
var helloGz = hexToBuf("1f8b08000000000000fff348cdc9c9d75128cf2fca4951e4020018a7557b0e000000");
var out = zlib.gunzipSync(helloGz);
assert(out.toString("utf8") === "Hello, world!\n",
       "gunzip 'Hello, world!\\n' (got: " + JSON.stringify(out.toString("utf8")) + ")");
console.log("ok: gunzipSync small payload");

// --- inflateSync (zlib wrapper) ---
// Generated via `perl -MCompress::Zlib -e '...'` for "compress me please".
var zhex = hexToBuf("789c4bcecf2d284a2d2e56c84d5528c8494d2c4e0500435406f9");
var z = zlib.inflateSync(zhex);
assert(z.toString("utf8") === "compress me please",
       "inflate zlib stream (got: " + JSON.stringify(z.toString("utf8")) + ")");
console.log("ok: inflateSync zlib stream");

// --- inflateRawSync ---
// Same payload, no zlib header/trailer (raw deflate).
var rawHex = hexToBuf("4bcecf2d284a2d2e56c84d5528c8494d2c4e0500");
var raw = zlib.inflateRawSync(rawHex);
assert(raw.toString("utf8") === "compress me please",
       "inflateRaw (got: " + JSON.stringify(raw.toString("utf8")) + ")");
console.log("ok: inflateRawSync");

// --- streaming createGunzip ---
var gunzipStream = zlib.createGunzip();
var collected = "";
var finished = false;
gunzipStream.on("data", function (c) { collected += String(c); });
gunzipStream.on("end",  function () { finished = true; });
gunzipStream.end(helloGz);

// --- compression works as of v0.14 (stored mode) ---
var gzCompressed = zlib.gzipSync(Buffer.from("x"));
assert(gzCompressed[0] === 0x1f && gzCompressed[1] === 0x8b, "gzip magic on gzipSync output");
assert(zlib.gunzipSync(gzCompressed).toString("utf8") === "x", "gzipSync round-trips");
console.log("ok: compression round-trips");

process.on("exit", function () {
    assert(finished, "gunzip stream 'end' fired");
    assert(collected === "Hello, world!\n",
           "stream result: " + JSON.stringify(collected));
    console.log("ok: streaming createGunzip");
    console.log("\nzlib_inflate smoke: all assertions passed");
});
