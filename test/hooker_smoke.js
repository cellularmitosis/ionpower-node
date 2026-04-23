// hooker: Cowboy Ben Alman's method hook/override helper. Used by
// grunt-era plugins; small but demonstrates prototype-level mutation.

var hooker = require("./vendor/hooker.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var target = {
    count: 0,
    inc: function () { this.count++; return this.count; }
};

// hook.before: run a side-effect before the original.
var hookCalls = 0;
hooker.hook(target, "inc", {
    pre: function () { hookCalls++; }
});
target.inc();
target.inc();
assert(hookCalls === 2, "pre-hook fired twice; got " + hookCalls);
assert(target.count === 2, "original still runs; count=" + target.count);
console.log("ok: hooker pre-hook");

// Unhook restores.
hooker.unhook(target, "inc");
target.inc();
assert(hookCalls === 2, "pre-hook didn't fire after unhook");
assert(target.count === 3, "original still works after unhook");
console.log("ok: hooker unhook restores");

console.log("\nhooker smoke: all assertions passed");
