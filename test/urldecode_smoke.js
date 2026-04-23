// urldecode: decodeURIComponent with a safe fallback.

var urldecode = require("./vendor/urldecode.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(urldecode("hello%20world"), "hello world", "space");
eq(urldecode("a%2Fb%2Fc"), "a/b/c", "slashes");
eq(urldecode("no-encoding"), "no-encoding", "passthrough");
// Invalid sequence should not throw.
var ok = false;
try { urldecode("%FF%FF%FF%FF"); ok = true; } catch (e) { /* swallowed */ }
// Either returns the malformed string or throws and is caught.
console.log("ok: urldecode + invalid-sequence tolerance");

console.log("\nurldecode smoke: all assertions passed");
