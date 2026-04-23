// p-* promise utility batch: p-defer, p-finally, p-locate, p-timeout,
// p-event + clean-stack + rfdc + neo-async.

var pDeferMod  = require("./vendor/p-defer.js");
var pFinallyMod= require("./vendor/p-finally.js");
var pLocateMod = require("./vendor/p-locate.js");
var pTimeoutMod= require("./vendor/p-timeout.js");
var pEventMod  = require("./vendor/p-event.js");
var cleanStackMod = require("./vendor/clean-stack.js");
var rfdc       = require("./vendor/rfdc.js");
var neoAsync   = require("./vendor/neo-async.js");

var pDefer = pDeferMod.default || pDeferMod;
var pFinally = pFinallyMod.default || pFinallyMod;
var pLocate = pLocateMod.default || pLocateMod;
var pTimeout = pTimeoutMod.default || pTimeoutMod;
var pEvent = pEventMod.default || pEventMod;
var cleanStack = cleanStackMod.default || cleanStackMod;
rfdc = rfdc.default || rfdc;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// p-defer: externally-resolved Promise.
var d = pDefer();
assert(typeof d.promise.then === "function", "p-defer has promise");
assert(typeof d.resolve === "function", "p-defer has resolve");
var resolved = null;
d.promise.then(function (v) { resolved = v; });
d.resolve(42);
assert(resolved === 42, "deferred resolved to 42");
console.log("ok: p-defer");

// p-finally: .finally shim.
var fin = false;
pFinally(Promise.resolve(1), function () { fin = true; });
assert(fin, "p-finally ran");
console.log("ok: p-finally");

// rfdc: really fast deep clone.
var orig = { a: { b: [1, 2, { c: 3 }] } };
var cloner = rfdc();
var cl = cloner(orig);
orig.a.b[2].c = 99;
assert(cl.a.b[2].c === 3, "rfdc independence");
console.log("ok: rfdc");

// neo-async: async flow-control lib.
assert(typeof neoAsync === "object", "neo-async loaded");
assert(typeof neoAsync.each === "function", "neo-async.each");
assert(typeof neoAsync.map  === "function", "neo-async.map");
assert(typeof neoAsync.parallel === "function", "neo-async.parallel");
console.log("ok: neo-async (surface)");

// clean-stack: strip node-internal frames from a stack trace.
var err = new Error("boom");
var cleaned = cleanStack(err.stack || "");
assert(typeof cleaned === "string", "clean-stack returns string");
console.log("ok: clean-stack");

console.log("\np_utils smoke: all assertions passed");
