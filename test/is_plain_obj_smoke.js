// is-plain-obj + is-regexp: tiny type predicates.

// is-plain-obj + is-regexp ship as ESM — `export default`. Through our
// babel fallback the transpiled CJS exposes the function under
// `.default` (ESM-to-CJS interop convention).
var isPlainObj = require("./vendor/is-plain-obj.js");
isPlainObj = isPlainObj.default || isPlainObj;
var isRegexp   = require("./vendor/is-regexp.js");
isRegexp = isRegexp.default || isRegexp;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

// is-plain-obj.
eq(isPlainObj({}), true, "{} is plain");
eq(isPlainObj({ a: 1 }), true, "{a:1} is plain");
eq(isPlainObj([]), false, "array not plain");
eq(isPlainObj(null), false, "null not plain");
eq(isPlainObj(new Date()), false, "Date not plain");
eq(isPlainObj(Object.create(null)), true, "Object.create(null) is plain");
console.log("ok: is-plain-obj");

// is-regexp.
eq(isRegexp(/a/), true, "/a/ is regex");
eq(isRegexp(new RegExp("x")), true, "new RegExp is regex");
eq(isRegexp("x"), false, "string not regex");
eq(isRegexp({}), false, "{} not regex");
console.log("ok: is-regexp");

console.log("\nis-plain-obj + is-regexp smoke: all assertions passed");
