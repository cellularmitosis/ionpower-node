// is-promise: thenable detector.

var isPromise = require("./vendor/is-promise.js");
isPromise = isPromise.default || isPromise;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

// Can't actually construct a Promise on our runtime — no event loop.
// Check the thenable duck-type.
eq(isPromise({ then: function () {} }), true, "thenable");
eq(isPromise({}), false, "plain object");
eq(isPromise(null), false, "null");
eq(isPromise(42), false, "number");
eq(isPromise("x"), false, "string");
console.log("ok: 5 is-promise forms");

console.log("\nis-promise smoke: all assertions passed");
