// split-on-first: split a string on the first occurrence of a separator.

var splitOnFirst = require("./vendor/split-on-first.js");
splitOnFirst = splitOnFirst.default || splitOnFirst;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(splitOnFirst("a=1=2", "="), ["a", "1=2"], "first only");
eq(splitOnFirst("only", "="), [], "no separator => empty array");
eq(splitOnFirst("=abc", "="), ["", "abc"], "separator at start");
eq(splitOnFirst("abc=", "="), ["abc", ""], "separator at end");
console.log("ok: 4 split-on-first forms");

console.log("\nsplit-on-first smoke: all assertions passed");
