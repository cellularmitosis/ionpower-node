// ES2022 / ES2023 small-API polyfill smoke.
// Libraries using lodash / modern targets call these without feature
// detection; this verifies our polyfills keep them from crashing.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- Object.hasOwn ---
assert(typeof Object.hasOwn === "function", "Object.hasOwn is function");
assert(Object.hasOwn({ a: 1 }, "a") === true, "Object.hasOwn own");
assert(Object.hasOwn({ a: 1 }, "b") === false, "Object.hasOwn missing");
assert(Object.hasOwn({}, "toString") === false, "Object.hasOwn ignores proto");
console.log("ok: Object.hasOwn");

// --- Array.prototype.at ---
var arr = [1, 2, 3, 4, 5];
assert(arr.at(0) === 1, "Array.at(0)");
assert(arr.at(-1) === 5, "Array.at(-1)");
assert(arr.at(-2) === 4, "Array.at(-2)");
assert(arr.at(99) === undefined, "Array.at out of range");
console.log("ok: Array.prototype.at");

// --- String.prototype.at ---
assert("hello".at(0) === "h", "String.at(0)");
assert("hello".at(-1) === "o", "String.at(-1)");
assert("hello".at(99) === undefined, "String.at out of range");
console.log("ok: String.prototype.at");

// --- String.prototype.replaceAll ---
assert("foo-bar-baz".replaceAll("-", "_") === "foo_bar_baz", "replaceAll basic");
assert("aaa".replaceAll("a", "b") === "bbb", "replaceAll multi");
assert("".replaceAll("x", "y") === "", "replaceAll empty");
// Global regex allowed
assert("a1b2c3".replaceAll(/\d/g, "#") === "a#b#c#", "replaceAll global regex");
// Non-global regex throws
var threw = false;
try { "a".replaceAll(/x/, "y"); } catch (e) { threw = true; }
assert(threw, "replaceAll non-global regex throws");
console.log("ok: String.prototype.replaceAll");

// --- Array.prototype.findLast / findLastIndex ---
assert([1, 2, 3, 4, 5].findLast(function (x) { return x < 4; }) === 3, "findLast");
assert([1, 2, 3, 4, 5].findLastIndex(function (x) { return x < 4; }) === 2, "findLastIndex");
assert([1, 2, 3].findLast(function (x) { return x > 10; }) === undefined, "findLast miss");
assert([1, 2, 3].findLastIndex(function (x) { return x > 10; }) === -1, "findLastIndex miss");
console.log("ok: Array findLast / findLastIndex");

// --- Array.prototype.toSorted / toReversed / toSpliced / with ---
var source = [3, 1, 2];
var sorted = source.toSorted();
eq(sorted, [1, 2, 3], "toSorted result");
eq(source, [3, 1, 2], "toSorted preserves source");

var reversed = source.toReversed();
eq(reversed, [2, 1, 3], "toReversed result");
eq(source, [3, 1, 2], "toReversed preserves source");

var spliced = [1, 2, 3, 4, 5].toSpliced(1, 2, "a", "b", "c");
eq(spliced, [1, "a", "b", "c", 4, 5], "toSpliced result");

var withOne = [1, 2, 3][("wi" + "th")](1, 99);  // avoid reserved-word surface issue in some parsers
// Or directly:
var withOne2 = [1, 2, 3].with(1, 99);
eq(withOne, [1, 99, 3], "with result");
eq(withOne2, [1, 99, 3], "with direct");
// Negative index
eq([1, 2, 3].with(-1, 99), [1, 2, 99], "with negative");
// Out of range throws
threw = false;
try { [1, 2, 3].with(99, 0); } catch (e) { threw = true; }
assert(threw, "with out-of-range throws");
console.log("ok: Array change-by-copy methods");

// --- Promise.any + AggregateError ---
assert(typeof AggregateError === "function", "AggregateError ctor present");
var ae = new AggregateError([new Error("x"), new Error("y")], "both failed");
assert(ae.name === "AggregateError", "AggregateError.name");
assert(ae.errors.length === 2, "AggregateError.errors length");

Promise.any([
    Promise.reject(new Error("a")),
    Promise.resolve("winner"),
    Promise.reject(new Error("b"))
]).then(function (v) {
    assert(v === "winner", "Promise.any picks the fulfilled");
    console.log("ok: Promise.any (one winner)");
}).catch(function (e) { console.error("FAIL: Promise.any winner", e); process.exit(1); });

Promise.any([
    Promise.reject(new Error("a")),
    Promise.reject(new Error("b"))
]).then(function () {
    console.error("FAIL: Promise.any expected AggregateError"); process.exit(1);
}, function (e) {
    assert(e.name === "AggregateError", "Promise.any all-rejected name");
    assert(e.errors.length === 2, "Promise.any all-rejected errors length");
    console.log("ok: Promise.any (all rejected)");
});

// --- structuredClone ---
assert(typeof structuredClone === "function", "structuredClone present");
var deep = { a: 1, b: { c: [1, 2, { d: 3 }] }, e: null };
var clone = structuredClone(deep);
eq(clone, deep, "structuredClone content equal");
assert(clone !== deep, "structuredClone new top-level reference");
assert(clone.b !== deep.b, "structuredClone new nested reference");
assert(clone.b.c !== deep.b.c, "structuredClone new array reference");

// Dates are preserved as Date
var d = structuredClone({ when: new Date(1234567890) });
assert(d.when instanceof Date, "structuredClone keeps Date type");
assert(d.when.getTime() === 1234567890, "structuredClone Date value");

// Regex preserved
var r = structuredClone(/foo/g);
assert(r instanceof RegExp && r.source === "foo" && r.flags === "g",
       "structuredClone keeps RegExp");

// Map + Set if present
if (typeof Map !== "undefined") {
    var m = new Map(); m.set("a", 1); m.set("b", 2);
    var mc = structuredClone(m);
    assert(mc instanceof Map && mc.size === 2 && mc.get("a") === 1,
           "structuredClone Map");
}
if (typeof Set !== "undefined") {
    var s = new Set([1, 2, 3]);
    var sc = structuredClone(s);
    assert(sc instanceof Set && sc.size === 3 && sc.has(2),
           "structuredClone Set");
}
console.log("ok: structuredClone");

process.on("exit", function () {
    console.log("\nes_modern smoke: done");
});
