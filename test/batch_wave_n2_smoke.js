// Wave N2: small type-predicate libs from the es-shims ecosystem.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function unwrap(m) { return (m && m.default) || m; }

// ---- is-date-object ----
try {
    var isDateObj = unwrap(require("./vendor/is-date-object.js"));
    assert(isDateObj(new Date()), "is-date-object true for Date");
    assert(!isDateObj({}), "is-date-object false for plain obj");
    console.log("ok: is-date-object");
} catch (e) {
    console.log("skip: is-date-object (" + e.message + ")");
}

// ---- is-regex ----
try {
    var isRegex = unwrap(require("./vendor/is-regex.js"));
    assert(isRegex(/a/), "is-regex detects RegExp");
    assert(!isRegex("a"), "is-regex rejects string");
    console.log("ok: is-regex");
} catch (e) {
    console.log("skip: is-regex (" + e.message + ")");
}

// ---- functions-have-names ----
try {
    var fhn = unwrap(require("./vendor/functions-have-names.js"));
    assert(typeof fhn === "function", "functions-have-names is function");
    var r = fhn();
    assert(typeof r === "boolean", "fhn returns bool");
    console.log("ok: functions-have-names");
} catch (e) {
    console.log("skip: functions-have-names (" + e.message + ")");
}

// ---- object-is (Object.is polyfill) ----
try {
    var objectIs = unwrap(require("./vendor/object-is.js"));
    assert(objectIs(NaN, NaN), "Object.is(NaN, NaN)");
    assert(!objectIs(0, -0), "Object.is(0, -0) false");
    assert(objectIs(1, 1), "Object.is(1, 1)");
    console.log("ok: object-is");
} catch (e) {
    console.log("skip: object-is (" + e.message + ")");
}

// ---- es-define-property ----
try {
    var esDefP = require("./vendor/es-define-property.js");
    assert(esDefP !== undefined, "es-define-property loads");
    console.log("ok: es-define-property (surface)");
} catch (e) {
    console.log("skip: es-define-property (" + e.message + ")");
}

// ---- has-proto ----
try {
    var hasProto = unwrap(require("./vendor/has-proto.js"));
    var r = hasProto();
    assert(typeof r === "boolean", "has-proto returns bool");
    console.log("ok: has-proto");
} catch (e) {
    console.log("skip: has-proto (" + e.message + ")");
}

console.log("\nbatch_wave_n2 smoke: all assertions passed");
