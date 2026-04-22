// Smoke test: qrcode-generator on ionpower-node.
var qrcode = require("./vendor/qrcode-generator.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var qr = qrcode(0, "L");          // type 0 (auto), error-correction L
qr.addData("Hello, PPC Tiger");
qr.make();

var moduleCount = qr.getModuleCount();
console.log("QR module count:", moduleCount);
assert(moduleCount > 0, "has modules");

// getModuleCount gives the dimension; isDark is the per-cell getter.
var darkCount = 0;
for (var r = 0; r < moduleCount; ++r) {
    for (var c = 0; c < moduleCount; ++c) {
        if (qr.isDark(r, c)) darkCount++;
    }
}
console.log("dark modules:", darkCount, "of", moduleCount * moduleCount);
assert(darkCount > 0, "has at least some dark modules");
assert(darkCount < moduleCount * moduleCount, "not all dark");

// ASCII render for eyeball.
var lines = [];
for (var r = 0; r < moduleCount; ++r) {
    var line = "";
    for (var c = 0; c < moduleCount; ++c) line += qr.isDark(r, c) ? "##" : "  ";
    lines.push(line);
}
console.log(lines.slice(0, 5).map(function(l){ return l.slice(0, 50); }).join("\n"));
console.log("...");

console.log("\nqrcode-generator smoke: all assertions passed");
