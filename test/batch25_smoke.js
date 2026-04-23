// Batch: randombytes, ieee754, buffer-from, url-join, detect-newline,
// set-blocking, require-directory.

var randombytes = require("./vendor/randombytes.js");
var ieee754     = require("./vendor/ieee754.js");
var bufferFrom  = require("./vendor/buffer-from.js");
var urlJoin     = require("./vendor/url-join.js");
var detectNewlineMod = require("./vendor/detect-newline.js");
// detect-newline exposes a named export `detectNewline` (ESM 4.x).
var detectNewline = detectNewlineMod.detectNewline
    || (detectNewlineMod.default && detectNewlineMod.default)
    || detectNewlineMod;
var setBlocking = require("./vendor/set-blocking.js");

randombytes = randombytes.default || randombytes;
bufferFrom = bufferFrom.default || bufferFrom;
urlJoin = urlJoin.default || urlJoin;
setBlocking = setBlocking.default || setBlocking;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); } }

// randombytes: produces a Buffer of N random bytes.
var rb = randombytes(16);
assert(Buffer.isBuffer(rb) || rb instanceof Uint8Array, "buffer");
assert(rb.length === 16, "length 16");
var rb2 = randombytes(16);
assert(rb.toString("hex") !== rb2.toString("hex"), "two calls differ");
console.log("ok: randombytes");

// ieee754: pack/unpack floats.
var buf = new Uint8Array(8);
ieee754.write(buf, 3.14159265, 0, false, 52, 8);
var read = ieee754.read(buf, 0, false, 52, 8);
assert(Math.abs(read - 3.14159265) < 1e-10, "roundtrip pi: " + read);
console.log("ok: ieee754 roundtrip");

// buffer-from: modern alternative to deprecated Buffer constructor.
var bf = bufferFrom("hello");
assert(Buffer.isBuffer(bf) || bf instanceof Uint8Array, "bufferFrom returns buffer");
eq(bf.toString(), "hello", "bufferFrom content");
console.log("ok: buffer-from");

// url-join.
eq(urlJoin("http://example.com", "api", "users"), "http://example.com/api/users", "basic");
eq(urlJoin("http://example.com/", "/api/", "/users"), "http://example.com/api/users", "slash normalization");
console.log("ok: url-join");

// detect-newline: figure out a string's line terminator.
eq(detectNewline("a\nb\nc"), "\n", "LF");
eq(detectNewline("a\r\nb"),  "\r\n", "CRLF");
// detect-newline returns undefined if no newline found.
assert(detectNewline("noline") === undefined, "no newlines -> undefined");
console.log("ok: detect-newline");

// set-blocking: sets a stream's isTTY/non-blocking mode. On non-TTY
// it's a no-op; just verify it loads + returns safely.
assert(typeof setBlocking === "function", "set-blocking loads");
setBlocking(true);  // should not throw
setBlocking(false);
console.log("ok: set-blocking (loads + no-throw)");

console.log("\nbatch25 smoke: all assertions passed");
