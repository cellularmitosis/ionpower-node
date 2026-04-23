// bytes: parse/format byte sizes.

var bytes = require("./vendor/bytes.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Format.
eq(bytes(1024), "1KB", "1024 formatted");
eq(bytes(1024 * 1024), "1MB", "1 MB formatted");
eq(bytes(1536, { unitSeparator: " " }), "1.5 KB", "fractional + separator");
console.log("ok: format");

// Parse.
eq(bytes("1KB"), 1024, "parse 1KB");
eq(bytes("1.5MB"), 1572864, "parse 1.5MB");
eq(bytes("10B"), 10, "parse 10B");
console.log("ok: parse");

console.log("\nbytes smoke: all assertions passed");
