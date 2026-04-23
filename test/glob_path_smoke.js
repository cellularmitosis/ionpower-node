// is-glob, is-extglob, slash, normalize-path: path/glob probes that
// half of gulp/webpack/fs-extra pipelines start with.

var isGlob        = require("./vendor/is-glob.js");
var isExtglob     = require("./vendor/is-extglob.js");
var slash         = require("./vendor/slash.js");
var normalizePath = require("./vendor/normalize-path.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(isGlob("*.js") === true, "*.js is a glob");
assert(isGlob("src/**/*.js") === true, "src/**/*.js is a glob");
assert(isGlob("!file.js") === true, "!file.js is a glob (negated)");
assert(isGlob("plain.txt") === false, "plain.txt is not a glob");
assert(isGlob("") === false, "empty is not a glob");
console.log("ok: is-glob");

assert(isExtglob("?(x|y)") === true, "?(x|y) is extglob");
assert(isExtglob("*.js") === false, "*.js is NOT extglob");
console.log("ok: is-extglob");

assert(slash("foo\\bar\\baz") === "foo/bar/baz", "backslash -> slash");
assert(slash("foo/bar") === "foo/bar", "forward slash preserved");
console.log("ok: slash");

// normalize-path: collapse duplicate slashes, strip trailing.
assert(normalizePath("foo\\bar\\baz") === "foo/bar/baz", "np backslash");
assert(normalizePath("foo//bar///baz") === "foo/bar/baz", "np dupe slashes");
assert(normalizePath("foo/bar/") === "foo/bar", "np strips trailing");
console.log("ok: normalize-path");

console.log("\nglob_path smoke: all assertions passed");
