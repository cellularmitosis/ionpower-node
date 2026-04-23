// lodash.defaults: mutate an object with defaults for missing keys.

var defaults = require("./vendor/lodash.defaults.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Missing keys filled from source.
var out = defaults({ a: 1 }, { a: 99, b: 2, c: 3 });
eq(out, { a: 1, b: 2, c: 3 }, "a stays, b/c filled");
console.log("ok: lodash.defaults fills missing");

// undefined counts as missing.
var out2 = defaults({ a: undefined, b: 2 }, { a: 1, c: 3 });
eq(out2, { a: 1, b: 2, c: 3 }, "undefined treated as missing");
console.log("ok: lodash.defaults: undefined counts as missing");

// null is a value — not filled.
var out3 = defaults({ a: null }, { a: 99 });
eq(out3, { a: null }, "null is a value (not missing)");
console.log("ok: lodash.defaults: null is a value");

console.log("\nlodash.defaults smoke: all assertions passed");
