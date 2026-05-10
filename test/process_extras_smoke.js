// process.execPath + process.binding stub (Node 10 parity, pass 1).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// process.execPath: absolute path to the runtime binary.
assert(typeof process.execPath === "string",
       "process.execPath is string");
assert(process.execPath.length > 0,
       "process.execPath non-empty: " + JSON.stringify(process.execPath));
console.log("ok: process.execPath =", process.execPath);

// process.argv[0] should match. Real Node guarantees this.
assert(process.execPath === process.argv[0],
       "process.execPath mirrors argv[0]; got " +
       JSON.stringify({ execPath: process.execPath, argv0: process.argv[0] }));
console.log("ok: process.execPath === process.argv[0]");

// process.binding(name) — empty stub. fs-minipass loads with binding('fs');
// constants is another common probe site.
assert(typeof process.binding === "function",
       "process.binding is function");
var fsB = process.binding("fs");
assert(typeof fsB === "object" && fsB !== null,
       "process.binding('fs') returns an object");
console.log("ok: process.binding('fs') -> object");
var conB = process.binding("constants");
assert(typeof conB === "object" && conB !== null,
       "process.binding('constants') returns an object");
console.log("ok: process.binding('constants') -> object");
// Empty stub — calling unknown methods should not crash; the binding
// object is just {} so accessor returns undefined.
assert(typeof fsB.writeBuffers === "undefined",
       "fs binding methods are undefined (empty stub)");
console.log("ok: binding stub has no internal methods exposed");

console.log("\nprocess extras smoke: all assertions passed");
