// md5-hex: convenience wrapper over crypto.createHash('md5'). Added
// MD5 to our Hash implementation this session.

var md5HexMod = require("./vendor/md5-hex.js");
var md5hex = md5HexMod.default || md5HexMod;

function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); } }

// RFC 1321 test vectors.
eq(md5hex(""),            "d41d8cd98f00b204e9800998ecf8427e", "empty string");
eq(md5hex("abc"),         "900150983cd24fb0d6963f7d28e17f72", "abc");
eq(md5hex("hello world"), "5eb63bbbe01eeed093cb22bb8f5acdc3", "hello world");
console.log("ok: md5-hex (3 RFC vectors)");

// Multi-chunk input array.
eq(md5hex(["hello", " ", "world"]), "5eb63bbbe01eeed093cb22bb8f5acdc3",
   "array of chunks");
console.log("ok: md5-hex array input");

console.log("\nmd5-hex smoke: all assertions passed");
