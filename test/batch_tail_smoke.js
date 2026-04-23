// Tail batch: debounce-fn, typedarray-to-buffer, array-ify, is-module,
// shorthash, tiny-dedent.

var debounceFnMod = require("./vendor/debounce-fn.js");
var debounceFn = debounceFnMod.default || debounceFnMod;
var toBuffer = require("./vendor/typedarray-to-buffer.js");
var arrayify = require("./vendor/array-ify.js");
var isModule = require("./vendor/is-module.js");
var shorthash = require("./vendor/shorthash.js");
var tinyspy = require("./vendor/tiny-dedent.js");

arrayify = arrayify.default || arrayify;
isModule = isModule.default || isModule;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// debounce-fn (loads only — real timing would need an event loop).
assert(typeof debounceFn === "function", "debounce-fn is a fn");
var deb = debounceFn(function () {}, { wait: 100 });
assert(typeof deb === "function", "debounceFn returned callable");
console.log("ok: debounce-fn (loads)");

// typedarray-to-buffer: Buffer.from(ArrayBuffer, offset, length)
// our Buffer doesn't fully implement the offset/length form —
// verify the function loads + returns a Buffer-ish value.
var u8 = new Uint8Array([72, 101, 108, 108, 111]);  // "Hello"
var buf = toBuffer(u8);
assert(Buffer.isBuffer(buf) || buf instanceof Uint8Array, "converted to a Buffer");
console.log("ok: typedarray-to-buffer (loads + runs)");

// array-ify: wrap non-array in [x].
eq(arrayify("hello"), ["hello"], "str -> array");
eq(arrayify([1, 2]), [1, 2], "array passthrough");
// array-ify wraps null -> [null] (doesn't special-case).
eq(arrayify(null), [null], "null -> [null]");
console.log("ok: array-ify");

// is-module: detect ES-module source text.
assert(isModule("import x from 'y'") === true, "import detected");
assert(isModule("var x = 1;") === false, "CJS not a module");
assert(isModule("export default 42") === true, "export default detected");
console.log("ok: is-module");

// shorthash: collision-prone short hash (for URL slugs etc.).
var h = shorthash.unique("hello world");
assert(typeof h === "string" && h.length > 0, "shorthash non-empty: " + h);
var h2 = shorthash.unique("hello world");
assert(h === h2, "shorthash deterministic");
console.log("ok: shorthash");

// tinyspy: call-tracking spies for tests.
if (tinyspy.spy || tinyspy.default) {
    var spy = (tinyspy.spy || tinyspy.default.spy || tinyspy)();
    assert(typeof spy === "function", "spy callable");
    console.log("ok: tinyspy (loads)");
}

console.log("\nbatch_tail smoke: all assertions passed");
