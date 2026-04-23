// path-to-regexp + path-is-inside + is-path-inside.

var pathToRegexp = require("./vendor/path-to-regexp.js");
var pathIsInside  = require("./vendor/path-is-inside.js");

pathToRegexp = pathToRegexp.pathToRegexp || pathToRegexp;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// path-to-regexp: Express-style routes.
var keys = [];
var re = pathToRegexp("/users/:id", keys);
assert(re instanceof RegExp, "regexp");
assert(keys.length >= 1 && keys[0].name === "id", "id param; got " + JSON.stringify(keys));
var m = re.exec("/users/42");
assert(m && m[1] === "42", "matched id=42");
console.log("ok: path-to-regexp");

// path-is-inside: child under parent check.
assert(pathIsInside("/a/b/c", "/a/b") === true, "c in b");
assert(pathIsInside("/a/x", "/a/b") === false, "x not in b");
console.log("ok: path-is-inside");

console.log("\npath-libs smoke: all assertions passed");
