// timers/promises + dns/promises smoke + wave 15 libs.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- timers/promises ----
var tp = require("timers/promises");
assert(typeof tp.setTimeout === "function", "timers/promises.setTimeout");
assert(typeof tp.setImmediate === "function", "timers/promises.setImmediate");

var t0 = Date.now();
tp.setTimeout(50, "hello").then(function (v) {
    var dt = Date.now() - t0;
    eq(v, "hello", "setTimeout resolves with value");
    assert(dt >= 40, "setTimeout waited >= 40ms (got " + dt + ")");
    console.log("ok: timers/promises.setTimeout");
}).catch(function (e) { console.error("FAIL: timers/promises", e); process.exit(1); });

tp.setImmediate(42).then(function (v) {
    eq(v, 42, "setImmediate resolves with value");
    console.log("ok: timers/promises.setImmediate");
});

// AbortSignal cancellation
var c = new AbortController();
tp.setTimeout(1000, "wont resolve", { signal: c.signal }).then(
    function () { console.error("FAIL: should have rejected"); process.exit(1); },
    function (err) {
        assert(err && (err.name === "AbortError" || /abort/i.test(err.message || "")),
               "rejection looks like abort (got " + JSON.stringify(err && err.message) + ")");
        console.log("ok: timers/promises AbortSignal cancellation");
    }
);
setTimeout(function () { c.abort(); }, 20);

// ---- dns/promises ----
var dnsp = require("dns/promises");
assert(typeof dnsp.lookup === "function", "dns/promises.lookup");
assert(typeof dnsp.resolve4 === "function", "dns/promises.resolve4");

dnsp.lookup("localhost").then(function (r) {
    assert(typeof r.address === "string", "lookup returns object with address");
    assert(r.family === 4 || r.family === 6, "family is 4 or 6");
    console.log("ok: dns/promises.lookup (got " + r.address + ")");
}).catch(function (e) {
    // Some hosts can't resolve localhost via gethostbyname; skip cleanly.
    console.log("skip: dns/promises.lookup (" + (e && e.message) + ")");
});

// ---- fastest-stable-stringify ----
try {
    var fss = unwrap(require("./vendor/fastest-stable-stringify.js"));
    assert(typeof fss === "function", "fastest-stable-stringify is function");
    eq(fss({ b: 1, a: 2 }), '{"a":2,"b":1}', "fss sorts keys");
    eq(fss({ x: [3, 1, 2] }), '{"x":[3,1,2]}', "fss preserves array order");
    console.log("ok: fastest-stable-stringify");
} catch (e) { console.log("skip: fastest-stable-stringify (" + e.message + ")"); }

// ---- object-inspect (Node-style util.inspect competitor) ----
try {
    var oi = unwrap(require("./vendor/object-inspect.js"));
    assert(typeof oi === "function", "object-inspect is function");
    var s = oi({ a: 1, b: [2, 3] });
    assert(typeof s === "string" && s.indexOf("a: 1") >= 0, "object-inspect output");
    var arrInspect = oi([1, "two", { three: 3 }]);
    assert(arrInspect.indexOf("two") >= 0, "object-inspect array");
    console.log("ok: object-inspect");
} catch (e) { console.log("skip: object-inspect (" + e.message + ")"); }

console.log("\npromise_wrappers smoke: inline done");
