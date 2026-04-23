// left-pad: pad a string on the left to a target length.

var leftPad = require("./vendor/left-pad.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(leftPad("hi", 5), "   hi", "default space");
eq(leftPad("42", 6, "0"), "000042", "zero pad");
eq(leftPad("already long enough", 3), "already long enough", "shorter target unchanged");
eq(leftPad(42, 4, 0), "0042", "numeric args");
console.log("ok: 4 left-pad forms");

console.log("\nleft-pad smoke: all assertions passed");
