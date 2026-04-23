// Tiny type-predicate libs: is-plain-object + is-number.

var isPlainObject = require("./vendor/is-plain-object.js").isPlainObject;
var isNumber      = require("./vendor/is-number.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(isPlainObject({}),              true,  "empty obj");
eq(isPlainObject({ a: 1 }),        true,  "obj w/ key");
eq(isPlainObject([]),              false, "array");
eq(isPlainObject(null),            false, "null");
eq(isPlainObject(new Date()),      false, "Date");
eq(isPlainObject("x"),             false, "string");
console.log("ok: is-plain-object");

eq(isNumber(5),       true, "int");
eq(isNumber(5.5),     true, "float");
eq(isNumber("5"),     true, "string-number");
eq(isNumber("five"),  false, "non-numeric string");
eq(isNumber(NaN),     false, "NaN");
eq(isNumber([]),      false, "array");
console.log("ok: is-number");

console.log("\ntinypreds smoke: all assertions passed");
