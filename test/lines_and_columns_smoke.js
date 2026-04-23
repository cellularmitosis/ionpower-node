// lines-and-columns: map a source-text char offset to {line, column}
// and vice versa.

var LCMod = require("./vendor/lines-and-columns.js");
var LinesAndColumns = LCMod.LinesAndColumns || LCMod.default || LCMod;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var src = "abc\ndef\nghi";
var lc = new LinesAndColumns(src);

// Offset -> location.
eq(lc.locationForIndex(0), { line: 0, column: 0 }, "offset 0");
eq(lc.locationForIndex(4), { line: 1, column: 0 }, "offset 4 (after \\n)");
eq(lc.locationForIndex(6), { line: 1, column: 2 }, "offset 6 (within line 1)");
console.log("ok: lines-and-columns.locationForIndex");

// Location -> offset.
eq(lc.indexForLocation({ line: 0, column: 0 }), 0,  "loc (0,0)");
eq(lc.indexForLocation({ line: 1, column: 2 }), 6,  "loc (1,2)");
console.log("ok: lines-and-columns.indexForLocation");

console.log("\nlines_and_columns smoke: all assertions passed");
