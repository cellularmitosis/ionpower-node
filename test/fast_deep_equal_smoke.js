// Smoke test: fast-deep-equal on ionpower-node.
var equal = require("./vendor/fast-deep-equal.js");

function ok(label, cond) {
    if (cond) console.log("ok: " + label);
    else { console.error("FAIL: " + label); process.exit(1); }
}

ok("primitives",          equal(1, 1));
ok("different primitives", !equal(1, 2));
ok("strings",             equal("hi", "hi"));
ok("arrays",              equal([1,2,3], [1,2,3]));
ok("arrays differ",       !equal([1,2,3], [1,2,4]));
ok("nested",              equal({a:{b:[1,2]}}, {a:{b:[1,2]}}));
ok("nested diff",         !equal({a:{b:[1,2]}}, {a:{b:[1,3]}}));
ok("key order agnostic",  equal({a:1, b:2}, {b:2, a:1}));
ok("missing key",         !equal({a:1}, {a:1, b:2}));
ok("dates equal",         equal(new Date("2020-01-01"), new Date("2020-01-01")));
ok("regexp equal",        equal(/foo/gi, /foo/gi));
ok("regexp differ",       !equal(/foo/gi, /foo/g));
ok("null !== undefined",  !equal(null, undefined));
ok("NaN equals NaN",      equal(NaN, NaN));   // fast-deep-equal treats NaN equal

console.log("\nfast-deep-equal smoke: all assertions passed");
