// glob-to-regexp: compile a glob pattern to a RegExp.

var glob2re = require("./vendor/glob-to-regexp.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var re = glob2re("*.js");
assert(re instanceof RegExp, "RegExp");
assert(re.test("foo.js"), "matches foo.js");
assert(!re.test("foo.txt"), "excludes foo.txt");
console.log("ok: *.js");

// Extended.
var re2 = glob2re("src/**/*.ts", { extended: true, globstar: true });
assert(re2.test("src/a/b/c.ts"), "deep ts");
assert(!re2.test("src/a/b.js"), "excludes js");
console.log("ok: **/*.ts globstar");

console.log("\nglob-to-regexp smoke: all assertions passed");
