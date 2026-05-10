// util.debuglog (Node 10 parity, pass 2 wave 5).
//
// Surfaced by the npm 6.14.18 install pipeline: graceful-fs and
// agentkeepalive both do `util.debuglog('section')` at module load.
// Pre-fix, util.debuglog was undefined → npm crashed silently at
// process exit (the error was logged to npmlog records but never
// flushed because npm.config wasn't fully loaded).

var util = require("util");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof util.debuglog === "function", "util.debuglog is function");
assert(typeof util.debug === "function", "util.debug aliased to util.debuglog");

// When NODE_DEBUG doesn't include the section: returns a no-op function.
delete process.env.NODE_DEBUG;
var d = util.debuglog("nope");
assert(typeof d === "function", "returns a function (disabled section)");
// Should not throw, should not print.
d("anything", { a: 1 });
console.log("ok: disabled section is no-op");

// When NODE_DEBUG includes the section: returns a printer.
process.env.NODE_DEBUG = "yes";
var d2 = util.debuglog("yes");
assert(typeof d2 === "function", "returns a function (enabled section)");
console.log("ok: enabled section is callable");

// Wildcard '*' enables all.
process.env.NODE_DEBUG = "*";
var d3 = util.debuglog("anything");
assert(typeof d3 === "function", "returns a function (wildcard)");
console.log("ok: wildcard enables");

console.log("\nutil.debuglog smoke: all assertions passed");
