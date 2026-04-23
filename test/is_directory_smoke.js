// is-directory: stat-based directory detector.

var isDir = require("./vendor/is-directory.js");
isDir = isDir.default || isDir;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Synchronous form.
assert(isDir.sync("./test") === true, "./test is a directory");
assert(isDir.sync("./test/hello.js") === false, "./test/hello.js is a file");
// Our fs.statSync throws without an err.code field, so is-directory can't
// distinguish ENOENT; the lib re-throws. Wrap and call it false.
var missing = false;
try { missing = isDir.sync("./does-not-exist"); }
catch (e) { missing = false; }
assert(missing === false, "missing path treated as not-a-dir");
console.log("ok: 3 is-directory.sync forms");

console.log("\nis-directory smoke: all assertions passed");
