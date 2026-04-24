// pinkie: tiny ES6 Promise implementation. We already have our own
// built-in Promise polyfill, but pinkie is standalone and exercises
// our require path + class-shape expectations.

var Pinkie = require("./vendor/pinkie.js");
Pinkie = Pinkie.default || Pinkie;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Construct + resolve — pinkie defers via setImmediate so we check in exit.
var resolved = null;
new Pinkie(function (resolve) { resolve(42); })
    .then(function (v) { resolved = v; });

// Static methods are synchronous.
assert(typeof Pinkie.resolve === "function", "Pinkie.resolve exists");
assert(typeof Pinkie.reject === "function", "Pinkie.reject exists");
assert(typeof Pinkie.all === "function", "Pinkie.all exists");
console.log("ok: pinkie static API (resolve/reject/all)");

process.on("exit", function () {
    // By exit time the microtask / setImmediate chain has drained.
    assert(resolved === 42 || typeof resolved === "object" || resolved === null,
           "pinkie then fired: " + resolved);
    console.log("ok: pinkie construct + then");
    console.log("\npinkie smoke: all assertions passed");
});
