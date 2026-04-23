// numeral.js: number formatting (commas, currency, percent, etc.)

var numeral = require("./vendor/numeral.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(numeral(1234567).format("0,0"), "1,234,567", "commas");
eq(numeral(0.5).format("0.00%"), "50.00%", "percent");
eq(numeral(1500).format("$0,0.00"), "$1,500.00", "currency");
eq(numeral(1234567).format("0.0a"), "1.2m", "abbreviation");
console.log("ok: 4 numeral formats");

// Parse.
eq(numeral("$1,234.56").value(), 1234.56, "parse $1,234.56");
console.log("ok: parse");

console.log("\nnumeral smoke: all assertions passed");
