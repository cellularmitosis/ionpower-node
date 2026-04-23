// assert-plus: type-aware assert wrappers.

var assert = require("./vendor/assert-plus.js");

function caught(fn) { try { fn(); return false; } catch (e) { return true; } }

// Happy path — no throws.
assert.string("hello", "s");
assert.number(42, "n");
assert.bool(true, "b");
assert.object({}, "o");
assert.array([], "arr");
console.log("ok: happy paths");

// Wrong types throw.
if (!caught(function () { assert.string(42, "s"); }))        { console.error("FAIL: 42 as string"); process.exit(1); }
if (!caught(function () { assert.number("nope", "n"); }))    { console.error("FAIL: string as number"); process.exit(1); }
if (!caught(function () { assert.object("nope", "o"); }))    { console.error("FAIL: string as object"); process.exit(1); }
console.log("ok: wrong types throw");

// optional.
assert.optionalString(undefined, "os");
assert.optionalString("hi", "os");
if (!caught(function () { assert.optionalString(42, "os"); })) { console.error("FAIL: opt wrong type"); process.exit(1); }
console.log("ok: optional*");

console.log("\nassert-plus smoke: all assertions passed");
