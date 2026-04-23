// defu + iterall + expand-template: tiny utilities.

var defuMod = require("./vendor/defu.js");
var defu = defuMod.default || defuMod;
var iterall = require("./vendor/iterall.js");
var expand = require("./vendor/expand-template.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// defu: last-wins deep defaults (inverted from Object.assign).
eq(defu({ a: 1 }, { a: 99, b: 2, nested: { c: 3 } }),
   { a: 1, b: 2, nested: { c: 3 } }, "defu");
console.log("ok: defu (deep defaults, last wins)");

// iterall.isIterable.
assert(iterall.isIterable([]) === true, "[] is iterable");
assert(iterall.isIterable("abc") === true, "string is iterable");
assert(iterall.isIterable(new Set()) === true, "Set is iterable");
assert(iterall.isIterable({}) === false, "object not iterable");
console.log("ok: iterall.isIterable");

// iterall.forEach over an iterable.
var seen = [];
iterall.forEach([1, 2, 3], function (v, i) { seen.push(i + ":" + v); });
eq(seen, ["0:1", "1:2", "2:3"], "iterall.forEach");
console.log("ok: iterall.forEach");

// expand-template is a factory: call expand(opts) to get an expander.
var exp = expand();
var out = exp("hello {name}, welcome to {place}", {
    name: "jason", place: "ionpower"
});
assert(out === "hello jason, welcome to ionpower", "expand-template: " + out);
console.log("ok: expand-template");

console.log("\ndefu_iterall smoke: all assertions passed");
