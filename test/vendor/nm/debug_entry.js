// debug uses process.env.DEBUG to enable namespaces.
process.env.DEBUG = "ionpower:*";

var debug = require("debug");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var log = debug("ionpower:test");
assert(typeof log === "function", "debug returns a function");
// When the namespace is enabled and DEBUG is set, it writes to stderr.
log("hello from the debug logger");
console.log("ok: debug logger invoked");

// Inspect state.
assert(typeof debug.enable === "function",  "debug.enable exists");
assert(typeof debug.enabled === "function", "debug.enabled exists");
assert(debug.enabled("ionpower:test") === true, "enabled by ionpower:*");
assert(debug.enabled("other:thing") === false,  "not enabled for other");
console.log("ok: enable / enabled");

console.log("\ndebug smoke: all assertions passed");
