// error-ex: easy Error subclass construction with template-interpolated
// messages and per-property augmentation.

var errorEx = require("./vendor/error-ex.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Build a custom JSONError type.
var JSONError = errorEx("JSONError", {
    fileName: errorEx.append("in %s"),
    line: errorEx.append("on line %s")
});

var err = new JSONError("missing comma");
err.fileName = "config.json";
err.line = 14;

var msg = err.message;
assert(msg.indexOf("missing comma") !== -1, "original msg preserved");
assert(msg.indexOf("config.json") !== -1, "filename appended");
assert(msg.indexOf("14") !== -1, "line appended");
console.log("ok: error-ex composed message:", msg);

// Instance-of checks work.
assert(err instanceof JSONError, "err is JSONError");
assert(err instanceof Error, "err is Error");
console.log("ok: error-ex instanceof");

console.log("\nerror-ex smoke: all assertions passed");
