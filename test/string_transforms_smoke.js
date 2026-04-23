// camelize + dashify + markdown-escape: tiny string transforms batch.

var camelizeMod = require("./vendor/camelize.js");
var camelize = camelizeMod.default || camelizeMod;
var dashify = require("./vendor/dashify.js");
var markdownEscapeMod = require("./vendor/markdown-escape.js");
var markdownEscape = markdownEscapeMod.default || markdownEscapeMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// camelize: "foo-bar" -> "fooBar"; also works on objects.
eq(camelize("foo-bar-baz"), "fooBarBaz", "dashes -> camel");
eq(camelize("foo_bar"),     "fooBar",    "underscore -> camel");
console.log("ok: camelize");

// dashify: "fooBar" -> "foo-bar".
eq(dashify("fooBarBaz"),    "foo-bar-baz", "camel -> dashes");
eq(dashify("HelloWorld"),   "hello-world", "pascal -> dashes");
console.log("ok: dashify");

// markdown-escape: escape *_`[]()# in markdown.
var out = markdownEscape("Hello *world* with `code` and [link](x)");
assert(out.indexOf("\\*") !== -1, "* escaped: " + out);
assert(out.indexOf("\\`") !== -1, "` escaped");
assert(out.indexOf("\\[") !== -1, "[ escaped");
console.log("ok: markdown-escape");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

console.log("\nstring_transforms smoke: all assertions passed");
