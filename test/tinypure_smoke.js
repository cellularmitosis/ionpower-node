// Tiny tests for array-differ + arr-flatten + requires-port +
// querystringify — all standalone single-file CJS.

var arrayDiffer    = require("./vendor/array-differ.js");
var arrFlatten     = require("./vendor/arr-flatten.js");
var requiresPort   = require("./vendor/requires-port.js");
var querystringify = require("./vendor/querystringify.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

arrayDiffer = arrayDiffer.default || arrayDiffer;
eq(arrayDiffer([1, 2, 3], [2]), [1, 3], "differ 1,2,3 minus 2");
eq(arrayDiffer(["a", "b"], ["b"], ["c"]), ["a"], "differ multi");
console.log("ok: array-differ");

eq(arrFlatten([1, [2, [3, [4]]], 5]), [1, 2, 3, 4, 5], "arr-flatten recursive");
console.log("ok: arr-flatten");

if (requiresPort(80, "http") !== false) { console.error("FAIL: http:80 no"); process.exit(1); }
if (requiresPort(8080, "http") !== true) { console.error("FAIL: http:8080 yes"); process.exit(1); }
if (requiresPort(443, "https") !== false) { console.error("FAIL: https:443 no"); process.exit(1); }
console.log("ok: requires-port");

eq(querystringify.parse("a=1&b=hello"), { a: "1", b: "hello" }, "qs parse");
eq(querystringify.stringify({ a: 1, b: "hi" }), "a=1&b=hi", "qs stringify");
console.log("ok: querystringify");

console.log("\ntinypure smoke: all assertions passed");
