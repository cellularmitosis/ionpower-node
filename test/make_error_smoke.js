// make-error: Error-subclass factory.

// make-error sets module.exports = makeError AND stamps
// .BaseError on the factory. Use the factory directly.
var makeError = require("./vendor/make-error.js");
if (typeof makeError !== "function" && makeError.default) makeError = makeError.default;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var NotFoundError = makeError("NotFoundError");
var e = new NotFoundError("user 42 missing");
assert(e instanceof NotFoundError, "instanceof own");
assert(e instanceof Error, "instanceof Error");
assert(e.name === "NotFoundError", "name set: " + e.name);
assert(e.message === "user 42 missing", "message set");
console.log("ok: make-error subclass");

// Chain: subclass of subclass.
var NotUserError = makeError("NotUserError", NotFoundError);
var e2 = new NotUserError("bad id");
assert(e2 instanceof NotUserError, "sub-sub instanceof");
assert(e2 instanceof NotFoundError, "sub-sub instanceof parent");
assert(e2 instanceof Error, "sub-sub instanceof Error");
console.log("ok: make-error subclass chain");

console.log("\nmake-error smoke: all assertions passed");
