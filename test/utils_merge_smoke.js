// utils-merge: Express.js's simple object merger (TJ Holowaychuk).

var merge = require("./vendor/utils-merge.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var a = { x: 1, y: 2 };
merge(a, { y: 99, z: 3 });
eq(a, { x: 1, y: 99, z: 3 }, "merge overwrites + extends");
console.log("ok: utils-merge mutates target");

// Merging undefined is a no-op.
var b = { a: 1 };
merge(b, undefined);
eq(b, { a: 1 }, "merge undefined no-op");
console.log("ok: utils-merge tolerates undefined");

console.log("\nutils-merge smoke: all assertions passed");
