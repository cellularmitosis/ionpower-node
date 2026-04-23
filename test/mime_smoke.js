// mime-types + Mime: HTTP Content-Type lookup. mime-types wraps
// mime-db's data; Mime is a bare constructor class.

var mimeTypes = require("./vendor/mime-types.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// mime-types.lookup('foo.html') -> 'text/html'.
assert(mimeTypes.lookup("foo.html") === "text/html", "html lookup");
assert(mimeTypes.lookup("image.png") === "image/png", "png lookup");
assert(mimeTypes.lookup("style.css") === "text/css", "css lookup");
assert(mimeTypes.lookup("noext") === false, "unknown -> false");
console.log("ok: mime-types.lookup (4 cases)");

// .extension('image/jpeg') -> 'jpeg' (or 'jpg' depending on db).
var jpegExt = mimeTypes.extension("image/jpeg");
assert(jpegExt === "jpeg" || jpegExt === "jpg", "jpeg ext: " + jpegExt);
console.log("ok: mime-types.extension");

// .contentType: adds charset for text/*.
var ct = mimeTypes.contentType("text/html");
assert(/text\/html; ?charset/.test(ct), "contentType adds charset: " + ct);
console.log("ok: mime-types.contentType");

// Mime class (from mime@3.x) — constructor-based.
var Mime = require("./vendor/mime.js");
var m = new Mime({ "text/x-custom": ["custom"] });
assert(m.getType("foo.custom") === "text/x-custom", "custom getType");
assert(m.getExtension("text/x-custom") === "custom", "custom getExtension");
console.log("ok: Mime class: custom registration");

console.log("\nmime smoke: all assertions passed");
