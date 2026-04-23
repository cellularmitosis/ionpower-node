// minipass: a streaming library Isaac built for tar / pacote / other
// npm internals. It does its own minimal EventEmitter/flow rather
// than leaning on `stream`. Good test of our events + util.inherits.

var Minipass = require("./vendor/minipass.js");
Minipass = Minipass.default || Minipass.Minipass || Minipass;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var mp = new Minipass();
assert(typeof mp.on === "function",    "has .on");
assert(typeof mp.pipe === "function",  "has .pipe");
assert(typeof mp.write === "function", "has .write");
assert(typeof mp.end === "function",   "has .end");
console.log("ok: minipass constructor + core methods");

// Buffered mode: write, then read.
var chunks = [];
mp.on("data", function (chunk) { chunks.push(String(chunk)); });
mp.write("hello");
mp.write(" world");
mp.end();
// By spec, after end(), the 'end' event fires and accumulated chunks
// are delivered. Under our synchronous runtime this happens during
// the .end() call.
assert(chunks.length >= 1, "at least one data event fired; got " + chunks.length);
var combined = chunks.join("");
assert(combined.indexOf("hello") !== -1 && combined.indexOf("world") !== -1,
       "data received: " + combined);
console.log("ok: minipass write -> data events");

console.log("\nminipass smoke: all assertions passed");
