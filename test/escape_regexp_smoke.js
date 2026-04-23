// escape-regexp-component: escape special regex characters.

var escapeRegExp = require("./vendor/escape-regexp.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(escapeRegExp("a.b"), "a\\.b", "dot");
eq(escapeRegExp("1+2"), "1\\+2", "plus");
eq(escapeRegExp("(x)"), "\\(x\\)", "parens");
eq(escapeRegExp("a*b?c"), "a\\*b\\?c", "star/qmark");
eq(escapeRegExp("plain"), "plain", "plain passthrough");
console.log("ok: 5 escape-regexp forms");

console.log("\nescape-regexp smoke: all assertions passed");
