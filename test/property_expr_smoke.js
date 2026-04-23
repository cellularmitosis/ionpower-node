// property-expr: parse + evaluate dotted-path + array-index property
// expressions. Used by yup / Formik / redux-form.

var pe = require("./vendor/property-expr.js");
var getter = pe.getter;
var setter = pe.setter;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var obj = { a: { b: [10, 20, { c: "hit" }] } };

eq(getter("a.b.0")(obj),         10,    "getter a.b.0");
eq(getter("a.b[1]")(obj),        20,    "getter a.b[1]");
eq(getter("a.b[2].c")(obj),      "hit", "getter nested via brackets");
console.log("ok: property-expr getter");

// setter needs the intermediate object to exist (no auto-create).
var set = setter("a.x");
var o2 = { a: {} };
set(o2, 42);
eq(o2, { a: { x: 42 } }, "setter assigns into existing path");
console.log("ok: property-expr setter");

// split = parse (returns strings even for bracket indices).
var parts = pe.split("a.b[0].c");
eq(parts, ["a", "b", "0", "c"], "split mixed");
console.log("ok: property-expr.split");

console.log("\nproperty-expr smoke: all assertions passed");
