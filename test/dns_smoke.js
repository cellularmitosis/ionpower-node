// dns module smoke: lookup / resolve / promises.

var dns = require("dns");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- lookup localhost ---
var lookupResult = null;
var lookupErr = null;
dns.lookup("localhost", function (err, address, family) {
    lookupErr = err;
    lookupResult = { address: address, family: family };
});

// --- lookup with { all: true } ---
var allResult = null;
dns.lookup("localhost", { all: true }, function (err, addrs) { allResult = addrs; });

// --- resolve4 ---
var resolveErr = null;
var resolveResult = null;
dns.resolve4("localhost", function (err, addrs) {
    resolveErr = err;
    resolveResult = addrs;
});

// --- resolveMx / resolveTxt / etc — return empty arrays ---
var mxResult = null;
dns.resolveMx("example.com", function (err, mx) { mxResult = { err: err, mx: mx }; });

// --- promises ---
var promLookup = null;
dns.promises.lookup("localhost").then(function (r) { promLookup = r; });

// --- ENOTFOUND for bogus host ---
var bogusErr = null;
dns.lookup("this-host-definitely-does-not-exist-ionpower.invalid", function (err) {
    bogusErr = err;
});

// --- Synchronous lookup via net.lookup (not dns itself but a handy helper) ---
assert(typeof dns.lookup === "function", "dns.lookup is function");
assert(typeof dns.resolve === "function", "dns.resolve is function");
assert(typeof dns.promises.lookup === "function", "dns.promises.lookup is function");
console.log("ok: dns module surface");

process.on("exit", function () {
    assert(!lookupErr, "lookup localhost no err: " + (lookupErr && lookupErr.message));
    assert(lookupResult.address === "127.0.0.1",
           "lookup localhost -> 127.0.0.1 (got " + lookupResult.address + ")");
    assert(lookupResult.family === 4, "family 4");
    console.log("ok: dns.lookup");

    assert(Array.isArray(allResult) && allResult[0].address === "127.0.0.1",
           "dns.lookup {all:true}");
    console.log("ok: dns.lookup { all: true }");

    assert(!resolveErr && Array.isArray(resolveResult) && resolveResult[0] === "127.0.0.1",
           "dns.resolve4 localhost: " + JSON.stringify(resolveResult));
    console.log("ok: dns.resolve4");

    assert(mxResult && !mxResult.err && Array.isArray(mxResult.mx) && mxResult.mx.length === 0,
           "dns.resolveMx stub returns []");
    console.log("ok: dns.resolveMx stub");

    assert(bogusErr && bogusErr.code === "ENOTFOUND",
           "bogus host -> ENOTFOUND: " + (bogusErr && bogusErr.code));
    console.log("ok: dns.lookup ENOTFOUND");

    assert(promLookup && promLookup.address === "127.0.0.1" && promLookup.family === 4,
           "dns.promises.lookup: " + JSON.stringify(promLookup));
    console.log("ok: dns.promises.lookup");

    console.log("\ndns smoke: all assertions passed");
});
