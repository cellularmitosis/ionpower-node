// file-url: convert a filesystem path to a `file://` URL.

var fileUrl = require("./vendor/file-url.js");
fileUrl = fileUrl.default || fileUrl;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var u = fileUrl("/tmp/example.txt");
assert(u.indexOf("file://") === 0, "starts with file://");
assert(u.indexOf("tmp/example.txt") !== -1, "path component present: " + u);
console.log("ok: file-url absolute:", u);

// relative resolves to cwd.
var rel = fileUrl("subdir/file.txt");
assert(rel.indexOf("file://") === 0, "starts with file://");
console.log("ok: file-url relative:", rel);

// resolve: false keeps it literal.
var raw = fileUrl("relative.txt", { resolve: false });
assert(raw.indexOf("file://") === 0, "starts with file://");
assert(raw.indexOf("relative.txt") !== -1, "relative literal preserved");
console.log("ok: file-url no-resolve");

console.log("\nfile-url smoke: all assertions passed");
