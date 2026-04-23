// isobject: strict plain-object predicate (not arrays, not primitives).
// Small but gets pulled in by dozens of libs (extend, deep-extend, etc).

var isObject = require("./vendor/isobject.js");
// isobject was converted from ESM to CJS for consumer-friendliness
// (so get-value's bare `require('isobject')` works). Keep the
// .default guard for safety anyway.
isObject = isObject.default || isObject;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(isObject({}) === true, "{}");
assert(isObject({ a: 1 }) === true, "{a:1}");
assert(isObject([]) === false, "array is not object");
assert(isObject(null) === false, "null is not object");
assert(isObject("foo") === false, "string is not object");
assert(isObject(42) === false, "number is not object");
assert(isObject(function () {}) === false, "function is not object");
console.log("ok: isobject (7 cases)");

console.log("\nisobject smoke: all assertions passed");
