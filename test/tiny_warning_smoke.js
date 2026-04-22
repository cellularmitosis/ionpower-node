// tiny-warning: tiny conditional console.warn wrapper.

var warning = require("./vendor/tiny-warning.js");

// Capture console.warn output.
var warned = [];
var origWarn = console.warn;
console.warn = function () {
    warned.push(Array.prototype.join.call(arguments, " "));
};

warning(false, "this should emit");
warning(true, "this should NOT emit");
warning(0, "zero is falsy -> emit");
warning(1, "nonzero is truthy -> NOT emit");

console.warn = origWarn;

if (warned.length !== 2) {
    console.error("FAIL: expected 2 warnings, got", warned.length, warned);
    process.exit(1);
}
console.log("ok: tiny-warning: 2 warnings emitted on falsy conditions");

console.log("\ntiny-warning smoke: all assertions passed");
