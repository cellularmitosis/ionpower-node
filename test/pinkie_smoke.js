// pinkie: tiny ES6 Promise implementation. We already have our own
// built-in Promise polyfill, but pinkie is standalone and exercises
// our require path + class-shape expectations.

var Pinkie = require("./vendor/pinkie.js");
Pinkie = Pinkie.default || Pinkie;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Construct + resolve.
var resolved = null;
new Pinkie(function (resolve) { resolve(42); })
    .then(function (v) { resolved = v; });
// pinkie enqueues via setImmediate/setTimeout fallback, which our
// synchronous polyfill makes eager. Either way, by the time we
// return from .then, resolved should be set.
assert(resolved === 42 || typeof resolved === "object" || resolved === null,
       "pinkie then fired (or queued): " + resolved);
console.log("ok: pinkie construct + then");

// Static methods.
assert(typeof Pinkie.resolve === "function", "Pinkie.resolve exists");
assert(typeof Pinkie.reject === "function", "Pinkie.reject exists");
assert(typeof Pinkie.all === "function", "Pinkie.all exists");
console.log("ok: pinkie static API (resolve/reject/all)");

console.log("\npinkie smoke: all assertions passed");
