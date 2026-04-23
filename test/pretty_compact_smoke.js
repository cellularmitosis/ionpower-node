// json-stringify-pretty-compact: JSON with line width target.

var stringify = require("./vendor/json-stringify-pretty-compact.js");
stringify = stringify.default || stringify;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

var obj = { a: 1, b: 2, c: [1, 2, 3] };
var compact = stringify(obj, { maxLength: 100 });
// Fits on one line.
eq(compact, '{"a": 1, "b": 2, "c": [1, 2, 3]}', "compact under maxLength");

// Forced wrap.
var wrapped = stringify(obj, { maxLength: 10 });
if (wrapped.split("\n").length < 2) {
    console.error("FAIL: should wrap; got", wrapped);
    process.exit(1);
}
console.log("ok: compact + wrap");

console.log("\npretty-compact smoke: all assertions passed");
