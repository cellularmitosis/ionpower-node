// Loaded by test/strip_ansi_smoke.js via an absolute path so our
// require() walks up this file's directory and finds
// test/vendor/nm/node_modules/strip-ansi/ + ansi-regex/.
var strip = require("strip-ansi");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// Example ANSI-colored string (red on).
var colored = "\u001b[31mhello\u001b[39m world";
var plain   = strip(colored);
assert(plain === "hello world", "strip: got " + JSON.stringify(plain));
console.log("ok: strip-ansi removed color codes:", JSON.stringify(plain));

// Round-trip: stripping an already-plain string is a no-op.
assert(strip("no colors") === "no colors", "idempotent on plain");
console.log("ok: idempotent on plain input");

// More ornate sequences.
var fancy = "\u001b[1m\u001b[38;5;208mbold-orange\u001b[0m"
          + " + \u001b]8;;https://x.com\u0007link\u001b]8;;\u0007";
console.log("stripped fancy:", JSON.stringify(strip(fancy)));

console.log("\nstrip-ansi smoke: all assertions passed");
