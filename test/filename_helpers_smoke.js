// filename-reserved-regex + toidentifier: safe-filename helpers.

var reservedMod = require("./vendor/filename-reserved-regex.js");
var reserved = reservedMod.default || reservedMod;
var toid = require("./vendor/toidentifier.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// filename-reserved-regex: regex matching chars that can't appear
// in a filename on various OSes (< > : " / \ | ? *). Returns a /g
// regex; reset lastIndex between tests or use a fresh one.
function freshRe() {
    return typeof reserved === "function" ? reserved() : reserved;
}
assert(freshRe() instanceof RegExp, "returns a regex");
assert(freshRe().test("bad<file>.txt"),  "< and > are reserved");
assert(freshRe().test("q:name"),         ": is reserved");
assert(!freshRe().test("fine_name.txt"), "underscore is ok");
console.log("ok: filename-reserved-regex");

// toidentifier: "not an identifier" -> "NotAnIdentifier".
// Splits only on spaces (not dashes).
assert(toid("http error")     === "HttpError",   "http error");
assert(toid("not found")      === "NotFound",    "not found");
assert(toid("internal server error") === "InternalServerError", "multi-word");
console.log("ok: toidentifier");

console.log("\nfilename_helpers smoke: all assertions passed");
