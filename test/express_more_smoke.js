// More Express ecosystem: range-parser, methods, statuses, depd,
// debug, finalhandler. Plus p-cancelable, hex-color-regex,
// array-flatten@1.

var rangeParser = require("./vendor/range-parser.js");
var methods = require("./vendor/methods.js");
var statuses = require("./vendor/statuses.js");
// depd needs V8's Error.prepareStackTrace (callSite.getFileName),
// which SM45 doesn't expose. Skip the load test.
// debug@2.6.9 is multi-file (browser.js + node.js siblings); skip the
// load-test here — finalhandler gets a stub via vendor file patch.
var finalhandler = require("./vendor/finalhandler.js");
var pCancelable = require("./vendor/p-cancelable.js");
var hexColorRegex = require("./vendor/hex-color-regex.js");
var flatten = require("./vendor/array-flatten-v2.js");

rangeParser = rangeParser.default || rangeParser;
hexColorRegex = hexColorRegex.default || hexColorRegex;
flatten = flatten.flatten || flatten.default || flatten;
pCancelable = pCancelable.default || pCancelable;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// range-parser
var rs = rangeParser(1000, "bytes=0-499");
assert(rs.type === "bytes", "bytes range");
assert(rs[0].start === 0 && rs[0].end === 499, "range 0-499");
console.log("ok: range-parser");

// methods
assert(Array.isArray(methods), "methods is array");
assert(methods.indexOf("get") !== -1,  "has get");
assert(methods.indexOf("post") !== -1, "has post");
console.log("ok: methods (" + methods.length + ")");

// statuses
assert(typeof statuses === "function", "statuses is function");
assert(statuses(200) === "OK", "200 -> OK");
assert(statuses(404) === "Not Found", "404 -> Not Found");
assert(statuses("OK") === 200, "reverse lookup");
console.log("ok: statuses");

// depd skipped (needs Error.prepareStackTrace).

// finalhandler
assert(typeof finalhandler === "function", "finalhandler is function");
console.log("ok: finalhandler");

// p-cancelable
assert(typeof pCancelable === "function", "p-cancelable is constructor");
var pc = new pCancelable(function (resolve, reject, onCancel) { resolve("ok"); });
assert(typeof pc.cancel === "function", "has cancel method");
console.log("ok: p-cancelable");

// hex-color-regex
var hcr = hexColorRegex();
assert(hcr.test("#ff00cc"), "matches hex");
assert(!hcr.test("not a color"), "rejects non-hex");
console.log("ok: hex-color-regex");

// array-flatten@1
eq(flatten([1, [2, [3, [4]]]]), [1, 2, 3, 4], "flatten deep");
console.log("ok: array-flatten@1");

console.log("\nexpress_more smoke: all assertions passed");
