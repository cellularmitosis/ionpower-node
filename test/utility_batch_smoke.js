// Utility-batch: kleur-colors, nanoclone, is-even/is-odd, trim-
// repeated, escape-string-applescript, ansicolors.

var kleurMod = require("./vendor/kleur-colors.js");
var kleur = kleurMod.default || kleurMod;
var nanocloneMod = require("./vendor/nanoclone.js");
var nanoclone = nanocloneMod.default || nanocloneMod;
var isEven = require("./vendor/is-even.js");
var isOdd  = require("./vendor/is-odd.js");
var trimRepeatedMod = require("./vendor/trim-repeated.js");
var trimRepeated = trimRepeatedMod.default || trimRepeatedMod;
var escASMod = require("./vendor/escape-string-applescript.js");
var escapeAS = escASMod.default || escASMod;
var ansicolors = require("./vendor/ansicolors.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// kleur/colors: tiny chalk.
assert(typeof kleur.red === "function", "kleur.red");
var r = kleur.red("hi");
assert(r.indexOf("hi") !== -1, "kleur text preserved");
console.log("ok: kleur/colors");

// nanoclone.
var orig = { a: [1, 2, { b: 3 }] };
var c = nanoclone(orig);
orig.a[2].b = 99;
assert(c.a[2].b === 3, "nanoclone independence");
console.log("ok: nanoclone");

// is-even / is-odd.
assert(isOdd(3) === true, "3 odd");
assert(isOdd(4) === false, "4 not odd");
assert(isEven(4) === true, "4 even");
assert(isEven(3) === false, "3 not even");
console.log("ok: is-even/is-odd");

// trim-repeated: collapse repeated substrings at the edges.
eq(trimRepeated("---hello---", "-"), "-hello-", "trim-repeated dashes");
eq(trimRepeated("!!foo!!", "!"), "!foo!", "trim-repeated bangs");
console.log("ok: trim-repeated");

// escape-string-applescript.
var esc = escapeAS('hello "world"');
assert(esc.indexOf('\\"') !== -1, "escape-string-applescript: " + esc);
console.log("ok: escape-string-applescript");

// ansicolors.
assert(typeof ansicolors.red === "function", "ansicolors.red");
var red = ansicolors.red("error");
assert(red.indexOf("error") !== -1, "ansicolors text");
assert(red.indexOf("\u001B[") !== -1, "ansicolors ANSI");
console.log("ok: ansicolors");

console.log("\nutility_batch smoke: all assertions passed");
