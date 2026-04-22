// Smoke test: kleur (terminal colors, chalk-alternative) on ionpower-node.
//
// ionpower-node doesn't populate process.stdout.isTTY yet, so kleur's
// auto-detect will default to off (enabled == undefined/falsy). That's
// correct for non-TTY output; we just verify the API shape works, and
// that FORCE_COLOR=1 flips colors on when re-evaluated.

const fs = require("fs");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Default mode: not a TTY, no FORCE_COLOR -> colors off (no-op).
var k = require("./vendor/kleur.js");
console.log("enabled (default):", k.enabled);
assert(!k.enabled, "kleur.enabled should be falsy in non-TTY mode");
assert(k.red("hi") === "hi", "red(..)==input when disabled");
assert(k.bold().red("x") === "x", "chained returns input when disabled");
console.log("ok: colors disabled in non-TTY mode — API is transparent");

// 2. Force-on: set FORCE_COLOR, re-evaluate kleur in a fresh module
// wrapper (our require caches the first load, so we bypass cache by
// re-running the source through eval under a new module object).
process.env.FORCE_COLOR = "1";
var src = fs.readFileSync("test/vendor/kleur.js", "utf8");
var mod2 = { exports: {} };
(function (module, exports) { eval(src); })(mod2, mod2.exports);
var kForce = mod2.exports;
assert(kForce.enabled === true, "re-eval with FORCE_COLOR=1 should enable");
var red = kForce.red("hello");
assert(red.indexOf("\u001b[31m") === 0, "FORCE_COLOR emits ANSI red prefix");
assert(red.indexOf("\u001b[39m") > 0,  "FORCE_COLOR emits ANSI reset suffix");
console.log("ok: FORCE_COLOR=1 re-eval produced ANSI-wrapped output");
console.log("sample:", JSON.stringify(red));

console.log("\nkleur smoke: all assertions passed");
