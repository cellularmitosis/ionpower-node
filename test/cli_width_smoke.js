// cli-width: detect terminal width.

var cliWidth = require("./vendor/cli-width.js");
cliWidth = cliWidth.default || cliWidth;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// No TTY -> returns 0 unless you provide defaultWidth via opts.
var w = cliWidth();
assert(typeof w === "number", "got a number: " + w);
console.log("ok: cliWidth = " + w);

// With defaultWidth fallback.
var def = cliWidth({ defaultWidth: 120 });
assert(def === 120 || def > 0, "default width honored: " + def);
console.log("ok: defaultWidth=120 -> " + def);

console.log("\ncli-width smoke: all assertions passed");
