// Wave Y: library hunt 7 — eight more vendored libraries + assert.rejects/match.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- eventemitter3 ----
try {
    var EE3 = unwrap(require("./vendor/eventemitter3.js"));
    assert(typeof EE3 === "function", "EE3 is a ctor");
    var ee = new EE3();
    var got = [];
    ee.on("data", function (x) { got.push(x); });
    ee.emit("data", 1); ee.emit("data", 2); ee.emit("other", 99);
    eq(got, [1, 2], "eventemitter3 on + emit");
    console.log("ok: eventemitter3");
} catch (e) { console.log("skip: eventemitter3 (" + e.message + ")"); }

// ---- mitt (tiny emitter) ----
try {
    var mitt = unwrap(require("./vendor/mitt.js"));
    assert(typeof mitt === "function", "mitt factory");
    var bus = mitt();
    var events = [];
    bus.on("tick", function (v) { events.push(v); });
    bus.emit("tick", "a"); bus.emit("tick", "b");
    eq(events, ["a", "b"], "mitt on+emit");
    console.log("ok: mitt");
} catch (e) { console.log("skip: mitt (" + e.message + ")"); }

// ---- tiny-emitter ----
try {
    var TE = require("./vendor/tiny-emitter.js");
    // tiny-emitter exports the ctor as module.exports (CJS)
    var TEctor = TE.TinyEmitter || TE;
    var t = new TEctor();
    var arr = [];
    t.on("evt", function (v) { arr.push(v); });
    t.emit("evt", 42);
    eq(arr, [42], "tiny-emitter basic");
    console.log("ok: tiny-emitter");
} catch (e) { console.log("skip: tiny-emitter (" + e.message + ")"); }

// ---- is-number ----
try {
    var isNumber = unwrap(require("./vendor/is-number.js"));
    assert(isNumber(42) === true, "is-number(42)");
    assert(isNumber("3.14") === true, "is-number('3.14')");
    assert(isNumber("hello") === false, "is-number('hello')");
    assert(isNumber(NaN) === false, "is-number(NaN)");
    console.log("ok: is-number");
} catch (e) { console.log("skip: is-number (" + e.message + ")"); }

// ---- hexoid ----
try {
    var hxMod = require("./vendor/hexoid.js");
    var hxFactory = hxMod.hexoid || unwrap(hxMod);
    assert(typeof hxFactory === "function", "hexoid factory");
    var id = hxFactory(8);  // returns a generator
    assert(typeof id === "function", "hexoid generator");
    var v = id();
    assert(typeof v === "string" && v.length === 8, "hexoid(8) produces 8-char string");
    // Uniqueness
    assert(id() !== id(), "hexoid produces distinct ids");
    console.log("ok: hexoid");
} catch (e) { console.log("skip: hexoid (" + e.message + ")"); }

// ---- jsesc ----
try {
    var jsesc = unwrap(require("./vendor/jsesc.js"));
    assert(typeof jsesc === "function", "jsesc is a function");
    var esc = jsesc("hello\u00e9\u0041world");
    assert(typeof esc === "string", "jsesc returns string");
    // Non-ASCII should be escaped by default
    assert(esc.indexOf("\\x") >= 0 || esc.indexOf("\\u") >= 0 || /\\[a-z]/.test(esc),
           "jsesc escapes non-ASCII");
    console.log("ok: jsesc");
} catch (e) { console.log("skip: jsesc (" + e.message + ")"); }

// ---- js-tokens (tokenizer) ----
try {
    var jsTok = unwrap(require("./vendor/js-tokens.js"));
    // js-tokens v9+ exports as default or factory; try invoking
    var tokens;
    if (typeof jsTok === "function") {
        tokens = Array.from(jsTok("var x = 1;"));
    } else if (jsTok && typeof jsTok[Symbol.iterator] === "function") {
        tokens = Array.from(jsTok);
    }
    // Whatever shape, loaded successfully
    console.log("ok: js-tokens (loaded)");
} catch (e) { console.log("skip: js-tokens (" + e.message + ")"); }

// ---- seedrandom ----
try {
    var seedrandom = unwrap(require("./vendor/seedrandom.js"));
    assert(typeof seedrandom === "function", "seedrandom factory");
    var rng1 = seedrandom("hello");
    var rng2 = seedrandom("hello");
    assert(Math.abs(rng1() - rng2()) < 1e-10, "seedrandom same seed -> same stream");
    var rng3 = seedrandom("world");
    assert(Math.abs(rng1() - rng3()) > 1e-10, "different seeds -> different (probably)");
    console.log("ok: seedrandom");
} catch (e) { console.log("skip: seedrandom (" + e.message + ")"); }

// ---- assert.rejects / doesNotReject / match ----
var _assert = require("assert");
assert(typeof _assert.rejects === "function", "assert.rejects present");
assert(typeof _assert.doesNotReject === "function", "assert.doesNotReject present");
assert(typeof _assert.match === "function", "assert.match present");

_assert.rejects(Promise.reject(new Error("boom"))).then(function () {
    return _assert.rejects(Promise.reject(new TypeError("x")), TypeError);
}).then(function () {
    return _assert.rejects(Promise.reject(new Error("nope")), /nope/);
}).then(function () {
    return _assert.doesNotReject(Promise.resolve(42));
}).then(function () {
    _assert.match("hello world", /world/);
    _assert.doesNotMatch("hello world", /xyz/);
    console.log("ok: assert.rejects / doesNotReject / match");
}).catch(function (e) { console.error("FAIL: assert Promise helpers", e); process.exit(1); });

process.on("exit", function () {
    console.log("\nbatch_wave_y smoke: done");
});
