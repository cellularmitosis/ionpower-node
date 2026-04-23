// kind-of: more precise typeof. Distinguishes arguments / buffer /
// regexp / error / date / etc from plain objects.

var kindOf = require("./vendor/kind-of.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(kindOf(undefined),      "undefined",   "undefined");
eq(kindOf(null),           "null",        "null");
eq(kindOf(true),           "boolean",     "boolean");
eq(kindOf(42),             "number",      "number");
eq(kindOf("foo"),          "string",      "string");
eq(kindOf([]),             "array",       "array");
eq(kindOf({}),             "object",      "object");
eq(kindOf(new Date()),     "date",        "date");
eq(kindOf(/foo/),          "regexp",      "regexp");
eq(kindOf(new Error()),    "error",       "error");
eq(kindOf(function () {}), "function",    "function");
console.log("ok: kind-of (11 cases)");

console.log("\nkind-of smoke: all assertions passed");
