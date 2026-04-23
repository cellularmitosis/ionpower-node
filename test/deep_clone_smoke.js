// deep-clone: recursive clone (yet another one).

var dc = require("./vendor/deep-clone.js");
dc = dc.default || dc;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var orig = { a: 1, b: { c: [1, 2, 3] }, d: new Date(0) };
var dup = dc(orig);
eq(dup, orig, "equal content");
assert(dup !== orig, "different ref");
assert(dup.b !== orig.b, "nested different ref");

orig.b.c[0] = 99;
assert(dup.b.c[0] === 1, "dup unaffected by orig mutation");
console.log("ok: deep clone independence");

console.log("\ndeep-clone smoke: all assertions passed");
