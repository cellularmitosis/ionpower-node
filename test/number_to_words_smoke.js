// number-to-words: 42 -> "forty-two".

var ntw = require("./vendor/number-to-words.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(ntw.toWords(0), "zero", "0");
eq(ntw.toWords(42), "forty-two", "42");
eq(ntw.toWords(100), "one hundred", "100");
eq(ntw.toWords(1000), "one thousand", "1000");
eq(ntw.toWords(1234567), "one million, two hundred thirty-four thousand, five hundred sixty-seven", "1234567");
console.log("ok: toWords");

eq(ntw.toOrdinal(1), "1st", "1st");
eq(ntw.toOrdinal(22), "22nd", "22nd");
eq(ntw.toOrdinal(103), "103rd", "103rd");
console.log("ok: toOrdinal");

console.log("\nnumber-to-words smoke: all assertions passed");
