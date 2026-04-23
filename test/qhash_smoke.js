// qhash: quick key-value hashing with dotted paths.

var qhash = require("./vendor/qhash.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) { console.error("FAIL:", msg, "expected", sb, "got", sa); process.exit(1); }
}

// set via dotted path.
var target = {};
qhash.set(target, "a.b.c", 42);
eq(target, { a: { b: { c: 42 } } }, "dotted set");
console.log("ok: set dotted");

// get via dotted path.
assert(qhash.get(target, "a.b.c") === 42, "get a.b.c");
console.log("ok: get dotted");

// decorate: copy methods onto target, don't dot-split.
var dst = { existing: 1 };
qhash.decorate(dst, { greet: function () { return "hi"; }, n: 5 });
assert(typeof dst.greet === 'function' && dst.greet() === "hi", "decorate greet");
assert(dst.n === 5 && dst.existing === 1, "decorate preserved existing");
console.log("ok: decorate");

// selectField: pull a column from an array of objects.
var rows = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
var names = qhash.selectField(rows, "name");
eq(names, ["a", "b"], "selectField");
console.log("ok: selectField");

console.log("\nqhash smoke: all assertions passed");
