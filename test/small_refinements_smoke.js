// Small-refinement smoke: http.Agent shape + crypto.hash one-shot +
// AbortSignal.any already covered but re-verified here.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- http.Agent shape ----
var http = require("http");
assert(typeof http.Agent === "function", "http.Agent is a ctor");
assert(http.globalAgent instanceof http.Agent, "globalAgent is Agent");
var a = new http.Agent({ keepAlive: true, maxSockets: 10 });
assert(a.keepAlive === true, "keepAlive flag");
assert(a.maxSockets === 10, "maxSockets");
assert(typeof a.getName === "function", "getName method");
eq(a.getName({ host: "example.com", port: 443 }), "example.com:443", "getName shape");
assert(typeof a.destroy === "function", "destroy method");
console.log("ok: http.Agent shape");

// ---- crypto.hash one-shot ----
var crypto = require("crypto");
assert(typeof crypto.hash === "function", "crypto.hash one-shot present");

// FIPS test: SHA-256 of "abc" = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
eq(crypto.hash("sha256", "abc"),
   "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
   "crypto.hash('sha256', 'abc') FIPS");
eq(crypto.hash("sha1", "abc"), "a9993e364706816aba3e25717850c26c9cd0d89d",
   "crypto.hash('sha1', 'abc')");
eq(crypto.hash("md5", "abc"), "900150983cd24fb0d6963f7d28e17f72",
   "crypto.hash('md5', 'abc')");

// Base64 encoding
var b64 = crypto.hash("sha256", "abc", "base64");
assert(b64 === "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
       "crypto.hash sha256 abc base64");

// Buffer encoding
var buf = crypto.hash("sha256", "abc", "buffer");
assert(Buffer.isBuffer(buf) && buf.length === 32, "crypto.hash buffer = 32 bytes");
console.log("ok: crypto.hash one-shot");

// ---- AbortSignal.any (spec: first abort wins) ----
var c1 = new AbortController();
var c2 = new AbortController();
var combined = AbortSignal.any([c1.signal, c2.signal]);
assert(!combined.aborted, "combined not yet aborted");

var fired = 0;
combined.addEventListener("abort", function () { fired++; });

c1.abort(new Error("from c1"));
assert(combined.aborted === true, "combined aborted after c1 abort");
assert(fired === 1, "abort event fired");
// Further aborts don't fire again
c2.abort(new Error("from c2"));
assert(fired === 1, "abort event fires only once");
console.log("ok: AbortSignal.any");

console.log("\nsmall_refinements smoke: all assertions passed");
