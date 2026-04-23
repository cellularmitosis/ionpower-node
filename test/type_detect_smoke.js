// type-detect: Chai.js's type detector. Similar spirit to kind-of
// but with a different surface (returns e.g. "Array" vs "array").

var td = require("./vendor/type-detect.js");
var typeDetect = td.default || td;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(typeDetect(42),             "number",    "number");
eq(typeDetect("foo"),          "string",    "string");
eq(typeDetect([]),             "Array",     "Array");
eq(typeDetect({}),             "Object",    "Object");
eq(typeDetect(null),           "null",      "null");
eq(typeDetect(undefined),      "undefined", "undefined");
eq(typeDetect(new Date()),     "Date",      "Date");
eq(typeDetect(/foo/),          "RegExp",    "RegExp");
eq(typeDetect(new Error()),    "Error",     "Error");
console.log("ok: type-detect (9 cases)");

console.log("\ntype-detect smoke: all assertions passed");
