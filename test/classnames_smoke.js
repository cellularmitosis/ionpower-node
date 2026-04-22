// classnames: conditional CSS class joining.

var classNames = require("./vendor/classnames.js");

function eq(actual, expected, msg) {
    if (actual !== expected) {
        console.error("FAIL:", msg, "expected", JSON.stringify(expected), "got", JSON.stringify(actual));
        process.exit(1);
    }
}

eq(classNames("a", "b"), "a b", "two strings");
eq(classNames("a", { b: true, c: false }), "a b", "object w/ truthy");
eq(classNames(["a", "b", { c: true }]), "a b c", "array input");
eq(classNames(null, undefined, "x", 0, "y"), "x y", "falsy filtered");
eq(classNames({ foo: 1, bar: 0, baz: "", qux: "a" }), "foo qux", "truthy values");
console.log("ok: 5 classnames forms");

console.log("\nclassnames smoke: all assertions passed");
