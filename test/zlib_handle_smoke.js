// zlib stream class-form ._handle / ._processChunk / .close emulation.
// minizlib (vendored throughout the npm 6 ecosystem) reaches into the
// stream for synchronous decompression inside its Promise pipeline:
//
//   const nativeHandle = this[_handle]._handle
//   const originalNativeClose = nativeHandle.close
//   nativeHandle.close = () => {}
//   const originalClose = this[_handle].close
//   this[_handle].close = () => {}
//   result = this[_handle]._processChunk(chunk, flushFlag)
//   // finally:
//   this[_handle]._handle = nativeHandle
//   nativeHandle.close = originalNativeClose
//   this[_handle].close = originalClose
//   this[_handle].removeAllListeners('error')
//
// So _processChunk lives ON the stream, not inside ._handle. ._handle is
// a stub (with reassignable .close). _processChunk buffers chunks until
// flushFlag === Z_FINISH (4), then runs the bulk syncFn over the
// concatenated input.

var zlib = require("zlib");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function hexToBuf(h) {
    h = h.replace(/\s+/g, "");
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i/2] = parseInt(h.substr(i, 2), 16);
    return Buffer.from(out);
}

var Z_NO_FLUSH = 0;
var Z_FINISH = 4;

// "Hello, world!\n" gzipped.
var helloGz = hexToBuf("1f8b08000000000000fff348cdc9c9d75128cf2fca4951e4020018a7557b0e000000");

// --- Class-form constructors expose ._handle and ._processChunk ---
var modes = ["Gunzip", "Gzip", "Inflate", "Deflate", "InflateRaw", "DeflateRaw"];
for (var i = 0; i < modes.length; i++) {
    var mode = modes[i];
    var s = new zlib[mode]({});
    assert(typeof s === "object" && s !== null, mode + " constructed");
    assert(typeof s.close === "function",
           mode + " has reassignable .close");
    assert(typeof s._handle === "object" && s._handle !== null,
           mode + " has ._handle stub");
    assert(typeof s._handle.close === "function",
           mode + " ._handle.close is a reassignable function");
    assert(typeof s._processChunk === "function",
           mode + " ._processChunk is a function (on the stream, not ._handle)");
    assert(typeof s.removeAllListeners === "function",
           mode + " is an EventEmitter (has removeAllListeners)");
}
console.log("ok: all stream class-forms expose _handle/_processChunk/close");

// --- _processChunk single-shot decompression with Z_FINISH ---
var g = new zlib.Gunzip();
var out = g._processChunk(helloGz, Z_FINISH);
assert(Buffer.isBuffer(out) || out instanceof Uint8Array,
       "Gunzip._processChunk returns a Buffer/Uint8Array (got "
       + (out && out.constructor && out.constructor.name) + ")");
assert(String(out) === "Hello, world!\n",
       "Gunzip._processChunk returns 'Hello, world!\\n' (got: "
       + JSON.stringify(String(out)) + ")");
console.log("ok: Gunzip._processChunk single-shot with Z_FINISH");

// --- Buffering across calls (Z_NO_FLUSH then Z_FINISH) ---
var g2 = new zlib.Gunzip();
var halfA = helloGz.slice(0, 12);
var halfB = helloGz.slice(12);
var r1 = g2._processChunk(halfA, Z_NO_FLUSH);
assert(r1.length === 0, "intermediate chunk returns empty (got " + r1.length + ")");
var r2 = g2._processChunk(halfB, Z_FINISH);
assert(String(r2) === "Hello, world!\n",
       "final chunk decompresses concatenated input (got: " + JSON.stringify(String(r2)) + ")");
console.log("ok: Gunzip._processChunk buffers across chunks");

// --- Round-trip via _processChunk (Gzip then Gunzip) ---
var gz = new zlib.Gzip();
var gzipped = gz._processChunk(Buffer.from("ionpower"), Z_FINISH);
assert(gzipped[0] === 0x1f && gzipped[1] === 0x8b,
       "Gzip._processChunk emits gzip magic");
var gun = new zlib.Gunzip();
var rt = gun._processChunk(gzipped, Z_FINISH);
assert(String(rt) === "ionpower", "Gzip→Gunzip _processChunk round-trip");
console.log("ok: Gzip._processChunk round-trips");

// --- Reassignable closes (the exact dance minizlib does) ---
var s2 = new zlib.Gunzip();
var nh = s2._handle;
var origNativeClose = nh.close;
var origStreamClose = s2.close;
var nhCalls = 0, sCalls = 0;
nh.close = function () { nhCalls++; };
s2.close = function () { sCalls++; };
nh.close(); s2.close();
assert(nhCalls === 1 && sCalls === 1, "both closes are reassignable");
nh.close = origNativeClose;
s2.close = origStreamClose;
assert(typeof nh.close === "function" && typeof s2.close === "function",
       "restored closes are callable");
console.log("ok: ._handle.close and .close are swap-and-restore safe");

// --- _processChunk survives Buffer.concat being monkey-patched ---
// minizlib does `Buffer.concat = (args) => args` BEFORE calling
// _processChunk (it wants the array of output chunks back, not a
// single concat). Our _processChunk must NOT reach for the patched
// Buffer.concat when concatenating the BUFFERED INPUT chunks — it
// must capture the original at bootstrap time.
var origConcat = Buffer.concat;
Buffer.concat = function (args) { return args; };  // hostile patch
try {
    var g3 = new zlib.Gunzip();
    g3._processChunk(helloGz, Z_NO_FLUSH);  // accumulate into _procChunks
    var rt3 = g3._processChunk(Buffer.alloc(0), Z_FINISH);
    assert(String(rt3) === "Hello, world!\n",
           "_processChunk works under hostile Buffer.concat (got: "
           + JSON.stringify(String(rt3)) + ")");
} finally {
    Buffer.concat = origConcat;
}
console.log("ok: _processChunk survives Buffer.concat monkey-patch");

// --- removeAllListeners('error') after the dance ---
var s3 = new zlib.Gunzip();
s3.on("error", function () {});
s3.removeAllListeners("error");
assert(s3.listenerCount ? s3.listenerCount("error") === 0 : true,
       "removeAllListeners('error') leaves zero listeners");
console.log("ok: removeAllListeners('error') works on the stream");

console.log("\nzlib_handle smoke: all assertions passed");
