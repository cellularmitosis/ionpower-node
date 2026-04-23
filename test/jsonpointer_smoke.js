// jsonpointer: RFC 6901 JSON Pointer get/set.

var jp = require("./vendor/jsonpointer.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) { console.error("FAIL:", msg, "expected", sb, "got", sa); process.exit(1); }
}

var doc = { a: { b: [ { c: 42 }, { c: 43 } ] } };

assert(jp.get(doc, "/a/b/0/c") === 42, "get /a/b/0/c");
assert(jp.get(doc, "/a/b/1/c") === 43, "get /a/b/1/c");
console.log("ok: get");

jp.set(doc, "/a/b/0/c", 100);
assert(doc.a.b[0].c === 100, "set");
console.log("ok: set");

// Root.
assert(jp.get(doc, "") === doc, "root pointer");
console.log("ok: root");

// Tilde escapes: ~0 is ~, ~1 is /.
var e = {};
jp.set(e, "/a~1b/c~0d", 99);
assert(e["a/b"]["c~d"] === 99, "escape keys");
console.log("ok: escape ~0 / ~1");

console.log("\njsonpointer smoke: all assertions passed");
