// Big batch: qs@6.11, minimist-options, dashdash, upper-case/lower-
// case/capitalize v2, iban, tinycolor2, node-natural-sort.

var qs = require("./vendor/qs-v6.js");
var minimistOptsMod = require("./vendor/minimist-options.js");
var minimistOpts = minimistOptsMod.default || minimistOptsMod;
var dashdash = require("./vendor/dashdash.js");
var upperCaseMod = require("./vendor/upper-case-v2.js");
var lowerCaseMod = require("./vendor/lower-case-v2.js");
var capitalize = require("./vendor/capitalize.js");
var iban = require("./vendor/iban.js");
var tinycolor = require("./vendor/tinycolor2.js");
var naturalSortMod = require("./vendor/node-natural-sort.js");

var upperCase = upperCaseMod.upperCase || upperCaseMod.default || upperCaseMod;
var lowerCase = lowerCaseMod.lowerCase || lowerCaseMod.default || lowerCaseMod;
capitalize = capitalize.default || capitalize;
tinycolor = tinycolor.default || tinycolor;
var naturalSort = naturalSortMod.default || naturalSortMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); } }

// qs.
var q = qs.parse("a=1&b=2&nested[x]=hi");
assert(q.a === "1" && q.nested.x === "hi", "qs parse");
console.log("ok: qs@6.11 parse");

// minimist-options.
var opts = minimistOpts({ force: { type: "boolean", alias: "f", default: false } });
assert(typeof opts === "object", "minimist-options returns object");
assert(opts.boolean && opts.boolean.indexOf("force") !== -1, "force is bool");
console.log("ok: minimist-options");

// dashdash: CLI option parser.
var parser = dashdash.createParser({
    options: [{ names: ["help", "h"], type: "bool", help: "Print help." }]
});
var dd = parser.parse({ argv: ["--help"], slice: 0 });
assert(dd.help === true, "dashdash parsed --help");
console.log("ok: dashdash");

// upper-case / lower-case / capitalize.
eq(upperCase("hello"), "HELLO", "upperCase");
eq(lowerCase("HELLO"), "hello", "lowerCase");
eq(capitalize("hello world"), "Hello world", "capitalize");
console.log("ok: upper/lower/capitalize");

// iban validation.
assert(iban.isValid("DE89370400440532013000"), "valid German IBAN");
assert(!iban.isValid("NOPE"), "invalid rejected");
console.log("ok: iban");

// tinycolor2 (CSS color manipulation).
var col = tinycolor("#f00");
assert(col.toHex() === "ff0000", "red hex: " + col.toHex());
assert(col.toHsl().h === 0, "red hue=0");
console.log("ok: tinycolor2");

// node-natural-sort: "item1, item10, item2" -> "item1, item2, item10".
assert(typeof naturalSort === "function", "naturalSort is fn");
var sorter = naturalSort();
var sorted = ["item10", "item2", "item1"].sort(sorter);
eq(sorted[0], "item1", "natural sort first");
eq(sorted[2], "item10", "natural sort last");
console.log("ok: node-natural-sort");

console.log("\nbatch_big smoke: all assertions passed");
