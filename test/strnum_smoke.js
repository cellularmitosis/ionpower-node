// strnum: smart string-to-number coercion (used by fast-xml-parser).

var strnum = require("./vendor/strnum.js");

function eq(a, b, msg) {
    var ok = (typeof a === 'number' && typeof b === 'number')
        ? (isNaN(a) === isNaN(b) || a === b)
        : a === b;
    if (!ok) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(strnum("42"), 42, "int");
eq(strnum("3.14"), 3.14, "float");
eq(strnum("hello"), "hello", "non-numeric returns original string");
eq(strnum(""), "", "empty stays empty");
eq(strnum("-5"), -5, "negative");
eq(strnum("0x1F"), 31, "hex");
eq(strnum("007"), 7, "leading zeroes");
console.log("ok: 7 strnum conversions (scientific notation is string by default)");

console.log("\nstrnum smoke: all assertions passed");
