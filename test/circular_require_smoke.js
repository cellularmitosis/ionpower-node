// Circular require + module.exports reassignment (Node 10 parity, pass 2 wave 4).
//
// Surfaced by the npm 6.14.18 install pipeline: lib/utils/metrics.js does
// `const npm = require('../npm.js')` while npm.js itself is still
// evaluating (npm.js line 48 requires utils/metrics.js → metrics.js
// circular-requires npm.js → captures npm). Pre-fix, the cached entry
// was the ORIGINAL empty {} exports object. After npm.js does
// `module.exports = new EventEmitter()` and adds `npm.config = ...`,
// metrics.js's captured `npm` reference still pointed at the empty {}
// — so npm.config came back undefined and saveMetrics threw at install
// completion.
//
// Fix: cache the MODULE wrapper, not the exports object. LookupCache reads
// .exports from the module so circular requires see the live value.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Build a 3-file fixture under /tmp so the test is self-contained.
var fs = require("fs");
var path = require("path");

var dir = "/tmp/ionpower-circ-smoke-" + process.pid;
try { fs.mkdirSync(dir); } catch (_) {}

fs.writeFileSync(path.join(dir, "a.js"),
    "var EventEmitter = require('events');\n" +
    "module.exports = new EventEmitter();\n" +
    "var b = require('./b.js');\n" +
    "module.exports.flagSetByA = true;\n" +
    "module.exports.bRef = b;\n"
);
fs.writeFileSync(path.join(dir, "b.js"),
    "var a = require('./a.js');\n" +
    "module.exports = { capturedA: a, getCapturedA: function () { return a; } };\n"
);

var a = require(path.join(dir, "a.js"));
assert(typeof a.on === "function",
       "a is the EventEmitter (outer require sees user-reassigned exports)");
assert(a.flagSetByA === true,
       "a.flagSetByA reflects late mutation in a.js");

// The crucial assertion: b.js's circular require captured `a` DURING
// a.js's evaluation, after a.js did module.exports = new EventEmitter().
// Pre-fix this was a stale empty {} reference. After fix, b's captured a
// === the live module.exports.
var b = a.bRef;
assert(b.capturedA === a,
       "b.capturedA === a (circular require sees the SAME EventEmitter)");
assert(b.getCapturedA() === a,
       "b.getCapturedA() === a (closure sees same instance)");
assert(b.capturedA.flagSetByA === true,
       "b.capturedA.flagSetByA === true (sees mutations through live ref)");

// Second exercise: explicitly re-require b.js from main and confirm we
// get the OBJECT it exported (not the cached module wrapper). This
// catches the bug where the JS-side cache short-circuit returns the
// wrapper for '/'-prefixed cached entries instead of reading .exports.
var b2 = require(path.join(dir, "b.js"));
assert(b2 === b,
       "re-requiring b returns the SAME exports object (not the module wrapper)");
assert(typeof b2.getCapturedA === "function",
       "re-required b has the user-set .getCapturedA function");

console.log("ok: circular require returns live module.exports");

// Cleanup.
try {
    fs.unlinkSync(path.join(dir, "a.js"));
    fs.unlinkSync(path.join(dir, "b.js"));
    fs.rmdirSync(dir);
} catch (_) {}

console.log("\ncircular require smoke: all assertions passed");
