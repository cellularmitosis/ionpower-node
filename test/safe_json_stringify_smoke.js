// safe-json-stringify: JSON.stringify that survives circular refs.

var safe = require("./vendor/safe-json-stringify.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(safe({ a: 1 }), '{"a":1}', "plain");

var c = { name: "root" };
c.self = c;
var s = safe(c);
if (s.indexOf("[Circular]") < 0) {
    console.error("FAIL: circular: expected [Circular], got", s);
    process.exit(1);
}
console.log("ok: circular handled: " + s);

eq(safe([1, 2, 3]), "[1,2,3]", "array");
console.log("ok: array");

console.log("\nsafe-json-stringify smoke: all assertions passed");
