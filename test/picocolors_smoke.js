// picocolors: a tiny chalk alternative (no dependencies, ~300 LOC).

var pc = require("./vendor/picocolors.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// The browser build always returns uncolored text. The node build
// checks a TTY. Under our non-TTY runtime either result is fine;
// we test the API shape.
assert(typeof pc.red       === "function", "red is fn");
assert(typeof pc.green     === "function", "green is fn");
assert(typeof pc.bold      === "function", "bold is fn");
assert(typeof pc.italic    === "function", "italic is fn");
assert(typeof pc.underline === "function", "underline is fn");

var red = pc.red("hello");
assert(typeof red === "string" && red.indexOf("hello") !== -1, "red returns string with 'hello': " + red);
console.log("ok: picocolors API surface + round-trip");

console.log("\npicocolors smoke: all assertions passed");
