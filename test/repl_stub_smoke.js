// repl: stub. require('repl') resolves to a shape consumers can
// feature-detect; calling start() throws because we have no real
// readline-driven REPL.

var repl = require("repl");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof repl === "object" && repl !== null, "repl is an object");
assert(typeof repl.start === "function",       "repl.start is a function");
assert(typeof repl.REPLServer === "function",  "repl.REPLServer is a function");
assert(typeof repl.Recoverable === "function", "repl.Recoverable is a function");
console.log("ok: repl stub shape");

var threw = false;
try { repl.start({ prompt: "> " }); } catch (e) { threw = true; }
assert(threw, "repl.start throws (not implemented)");
console.log("ok: repl.start throws");

// module.isBuiltin should recognize 'repl'.
var Module = require("module");
assert(Module.isBuiltin("repl"),       "module.isBuiltin('repl')");
assert(Module.isBuiltin("node:repl"),  "module.isBuiltin('node:repl')");
console.log("ok: repl is a builtin per module.isBuiltin");

console.log("\nrepl stub smoke: all assertions passed");
