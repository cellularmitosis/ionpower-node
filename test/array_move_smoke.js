// array-move: tiny immutable array.mutateOrCopy(from, to).

var m = require("./vendor/array-move.js");
// Module shape varies by version. Normalize all three names.
var mm = m.default || m;
var arrayMoveImmutable = mm.arrayMoveImmutable || mm;
var arrayMoveMutable   = mm.arrayMoveMutable;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

if (arrayMoveImmutable) {
    eq(arrayMoveImmutable([1, 2, 3, 4], 0, 3), [2, 3, 4, 1], "immutable move front->end");
    eq(arrayMoveImmutable(["a", "b", "c"], 2, 0), ["c", "a", "b"], "immutable move end->front");
    console.log("ok: immutable");
}

if (arrayMoveMutable) {
    var arr = [1, 2, 3];
    arrayMoveMutable(arr, 0, 2);
    eq(arr, [2, 3, 1], "mutable in place");
    console.log("ok: mutable");
}

console.log("\narray-move smoke: all assertions passed");
