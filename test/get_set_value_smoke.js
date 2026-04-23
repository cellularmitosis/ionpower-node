// get-value + set-value: dot-path getters/setters (jonschlinkert's
// pair; dot-prop is the sindresorhus pair).

var getValue = require("./vendor/get-value.js");
var setValue = require("./vendor/set-value.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var obj = { a: { b: { c: 1 } } };

eq(getValue(obj, "a.b.c"), 1,    "get deep");
eq(getValue(obj, "a.b"),   { c: 1 }, "get mid");
eq(getValue(obj, "x.y"),   undefined, "get missing -> undefined");
console.log("ok: get-value");

var o2 = {};
setValue(o2, "a.b.c", 42);
eq(o2, { a: { b: { c: 42 } } }, "set creates path");

setValue(o2, "a.b.d", "hi");
eq(o2.a.b.d, "hi", "set augments existing");
console.log("ok: set-value");

console.log("\nget/set-value smoke: all assertions passed");
