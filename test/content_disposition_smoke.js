// content-disposition: build Content-Disposition headers per RFC 6266.
// Requires our safe-buffer shim to route to the built-in Buffer.

var cd = require("./vendor/content-disposition.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

// Basic — no filename.
eq(cd(), "attachment", "default attachment");
console.log("ok: content-disposition default");

// With filename.
var h = cd("report.pdf");
eq(h, 'attachment; filename="report.pdf"', "with filename");
console.log("ok: content-disposition filename");

// Non-ASCII filename triggers filename* encoding.
var h2 = cd("日本語.txt");
if (h2.indexOf("filename*=") === -1) { console.error("FAIL: expected filename*= for non-ASCII, got", h2); process.exit(1); }
console.log("ok: content-disposition non-ASCII:", h2);

// Parse
var p = cd.parse('attachment; filename="sample.txt"');
eq(p.type, "attachment", "parse type");
eq(p.parameters.filename, "sample.txt", "parse filename");
console.log("ok: content-disposition.parse");

console.log("\ncontent-disposition smoke: all assertions passed");
