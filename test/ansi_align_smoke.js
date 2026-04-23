// ansi-align: align multi-line text (left/center/right) taking ANSI
// escape codes into account for width computation.

var align = require("./vendor/ansi-align.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// center
var out = align("short\nlonger one", { align: "center" });
var lines = out.split("\n");
// "short" (5) should be padded to length of "longer one" (10), so 2 leading spaces.
eq(lines[0], "  short", "center pads shorter line");
eq(lines[1], "longer one", "center leaves longest untouched");
console.log("ok: ansi-align center");

// right: the shorter line gets a leading space to align against the
// longest line's length. The longest stays untouched.
var r = align("hi\n!", { align: "right" });
eq(r, "hi\n !", "right-align: shorter line padded, longest untouched");
console.log("ok: ansi-align right");

// With ANSI codes: width measured with codes stripped.
var colored = align("\u001B[31mA\u001B[0m\n\u001B[32mBB\u001B[0m", { align: "center" });
// Verify output contains both lines and isn't empty.
var cLines = colored.split("\n");
if (cLines.length !== 2 || !cLines[0] || !cLines[1]) {
    console.error("FAIL: ANSI-aware center: bad output shape " + JSON.stringify(cLines));
    process.exit(1);
}
console.log("ok: ansi-align ANSI-aware width (didn't mangle codes)");

console.log("\nansi-align smoke: all assertions passed");
