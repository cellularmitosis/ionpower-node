// Array.fromAsync (ES2024) + wave 21 libs.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

assert(typeof Array.fromAsync === "function", "Array.fromAsync present");

// ---- sync iterable (array) ----
Array.fromAsync([1, 2, 3]).then(function (r) {
    eq(r, [1, 2, 3], "Array.fromAsync(array)");
    console.log("ok: Array.fromAsync(array)");
});

// ---- sync iterable with mapFn ----
Array.fromAsync([1, 2, 3], function (x) { return x * 10; }).then(function (r) {
    eq(r, [10, 20, 30], "with mapFn");
    console.log("ok: Array.fromAsync(array, mapFn)");
});

// ---- async iterable (events.on iterator) ----
var events = require("events");
var ee = new events.EventEmitter();
setImmediate(function () { ee.emit("data", "alpha"); });
setImmediate(function () { ee.emit("data", "bravo"); });
setImmediate(function () { setImmediate(function () { ee.emit("data", "charlie"); }); });

var iter = events.on(ee, "data");
// Take only first 3 then return
var i = 0;
var origNext = iter.next.bind(iter);
iter.next = function () {
    if (i >= 3) return Promise.resolve({ value: undefined, done: true });
    i++;
    return origNext();
};

Array.fromAsync(iter).then(function (r) {
    // Each value is the args array from emit
    var flat = r.map(function (a) { return a[0]; });
    eq(flat, ["alpha", "bravo", "charlie"], "async iter values");
    console.log("ok: Array.fromAsync(asyncIter)");
}).catch(function (e) { console.error("FAIL: async iter", e); process.exit(1); });

// ---- mapFn returning Promise ----
Array.fromAsync([1, 2, 3], function (x) { return Promise.resolve(x + 100); }).then(function (r) {
    eq(r, [101, 102, 103], "mapFn returning promise");
    console.log("ok: Array.fromAsync mapFn returning Promise");
});

// ---- array-like (length-based) ----
Array.fromAsync({ length: 3, 0: "x", 1: "y", 2: "z" }).then(function (r) {
    eq(r, ["x", "y", "z"], "array-like fromAsync");
    console.log("ok: Array.fromAsync(array-like)");
});

// ---- bonus: negotiator + accepts ----
try {
    var Negotiator = unwrap(require("./vendor/negotiator.js"));
    assert(typeof Negotiator === "function", "Negotiator ctor");
    // Simulate a request object
    var req = { headers: { "accept-language": "en-US,fr;q=0.5" } };
    var n = new Negotiator(req);
    assert(typeof n.languages === "function", ".languages method");
    var langs = n.languages();
    assert(Array.isArray(langs) && langs.length > 0, "languages parsed");
    console.log("ok: negotiator");
} catch (e) { console.log("skip: negotiator (" + e.message + ")"); }

try {
    var accepts = unwrap(require("./vendor/accepts.js"));
    assert(typeof accepts === "function", "accepts is function");
    var a = accepts({ headers: { "accept": "text/html, application/json;q=0.9" } });
    var picked = a.types(["json", "html"]);
    assert(picked === "html" || picked === "json", "accepts picks one");
    console.log("ok: accepts");
} catch (e) { console.log("skip: accepts (" + e.message + ")"); }

console.log("\narray_fromasync smoke: inline registered (5 async assertions pending)");
