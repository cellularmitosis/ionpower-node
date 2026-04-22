// Smoke test: dequal (tinier fast-deep-equal alternative) on ionpower-node.
var dequal = require("./vendor/dequal.js");
var deq = dequal.dequal || dequal;

function ok(label, cond) { if (cond) console.log("ok: " + label); else { console.error("FAIL: " + label); process.exit(1); } }

ok("primitives",  deq(1, 1));
ok("diff prim", !deq(1, 2));
ok("strings",     deq("a", "a"));
ok("arrays",      deq([1,[2,3]], [1,[2,3]]));
ok("arrays diff",!deq([1,[2,3]], [1,[2,4]]));
ok("objects",     deq({a:1,b:2}, {b:2,a:1}));
ok("dates",       deq(new Date("2020-01-01"), new Date("2020-01-01")));
ok("regexp",      deq(/abc/gi, /abc/gi));
ok("null != undef",!deq(null, undefined));
ok("NaN == NaN",   deq(NaN, NaN));
ok("maps",         deq(new Map([["a",1]]), new Map([["a",1]])));
ok("sets",         deq(new Set([1,2,3]), new Set([3,2,1])));

console.log("\ndequal smoke: all assertions passed");
