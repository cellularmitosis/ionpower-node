// lodash.get and lodash.set — path-accessor pair. Hit lib #500+.

var get = require("./vendor/lodash-get.js");
var set = require("./vendor/lodash-set.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var deep = { a: { b: { c: 42 } } };
eq(get(deep, "a.b.c"),     42,     "get deep");
eq(get(deep, "a.b.missing", "default"), "default", "get default");
eq(get(deep, ["a", "b", "c"]), 42,  "get array path");
console.log("ok: lodash.get");

var target = {};
set(target, "a.b.c", 99);
eq(target, { a: { b: { c: 99 } } }, "set creates path");

set(target, ["a", "b", "d"], 100);
eq(target.a.b.d, 100, "set array path");
console.log("ok: lodash.set");

console.log("\nlodash_getset smoke: all assertions passed");
