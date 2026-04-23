// map-obj: map keys/values of an object (optionally deep).

var mapObj = require("./vendor/map-obj.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Uppercase keys.
var upper = mapObj({ foo: 1, bar: 2 }, function (k, v) { return [k.toUpperCase(), v]; });
eq(upper, { FOO: 1, BAR: 2 }, "uppercase keys");
console.log("ok: map-obj uppercase");

// Double values.
var doubled = mapObj({ a: 1, b: 2, c: 3 }, function (k, v) { return [k, v * 2]; });
eq(doubled, { a: 2, b: 4, c: 6 }, "doubled values");
console.log("ok: map-obj doubled");

// Deep mode.
var deep = mapObj(
    { foo: { bar: { baz: 1 } } },
    function (k, v) { return [k.toUpperCase(), v]; },
    { deep: true }
);
eq(deep, { FOO: { BAR: { BAZ: 1 } } }, "deep key uppercase");
console.log("ok: map-obj deep");

// Skip support.
var skipSym = mapObj.mapObjectSkip;
var skipped = mapObj({ a: 1, b: 2, c: 3 }, function (k, v) {
    if (k === "b") return skipSym;
    return [k, v];
});
eq(skipped, { a: 1, c: 3 }, "skip symbol drops key");
console.log("ok: map-obj skip");

console.log("\nmap-obj smoke: all assertions passed");
