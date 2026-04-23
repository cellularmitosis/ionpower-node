// chalk 1.x: terminal string styling. Exercises the vendor-path
// resolver end-to-end — chalk does `require('ansi-styles')` etc
// as bare specifiers, and the new resolver walks test/vendor/
// to find them without any per-library patching.

var chalk = require("./vendor/chalk.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// chalk.red('x') either returns the plain string (if !supportsColor)
// or wraps it in ANSI codes. Accept either — the interesting bit is
// that chalk loaded at all.
var red = chalk.red("error");
assert(typeof red === "string", "chalk.red returns string");
assert(red.indexOf("error") !== -1, "text preserved");
console.log("ok: chalk.red returned:", JSON.stringify(red));

// chalk.bold.blue chain.
var chain = chalk.bold.blue("hi");
assert(typeof chain === "string", "chain returns string");
assert(chain.indexOf("hi") !== -1, "chain preserves text");
console.log("ok: chalk.bold.blue chain");

// chalk.supportsColor reflects the seeded supports-color module.
// We expose the modern `{stdout, stderr}` shape; older chalks
// expected just `.level`. Accept either.
var sc = chalk.supportsColor;
assert(sc === false
       || (typeof sc === "object" && typeof sc.level === "number")
       || (typeof sc === "object" && ("stdout" in sc || "stderr" in sc)),
       "supportsColor shape: " + JSON.stringify(sc));
console.log("ok: chalk.supportsColor =", JSON.stringify(sc));

// chalk.stripColor (or chalk.styles) smoke.
if (typeof chalk.stripColor === "function") {
    var stripped = chalk.stripColor("\u001B[31mhello\u001B[0m");
    assert(stripped === "hello", "stripColor: " + stripped);
    console.log("ok: chalk.stripColor");
}

console.log("\nchalk smoke: all assertions passed");
