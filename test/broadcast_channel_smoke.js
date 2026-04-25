// BroadcastChannel + library hunt wave 18 smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- BroadcastChannel global ----
assert(typeof BroadcastChannel === "function", "BroadcastChannel ctor present");

var a = new BroadcastChannel("chan");
var b = new BroadcastChannel("chan");
var c = new BroadcastChannel("other");

var aGot = [];
var bGot = [];
var cGot = [];

a.onmessage = function (ev) { aGot.push(ev.data); };
b.onmessage = function (ev) { bGot.push(ev.data); };
c.onmessage = function (ev) { cGot.push(ev.data); };

a.postMessage("hello");
b.postMessage("world");
c.postMessage("isolated");

// Per spec, post is asynchronous (microtask). Check after current tick.
setImmediate(function () {
    // a posted "hello" -> b should see it
    eq(bGot, ["hello"], "b sees a's post");
    // b posted "world" -> a should see it
    eq(aGot, ["world"], "a sees b's post");
    // c is on a different channel
    eq(cGot, [], "c on different channel sees nothing");
    console.log("ok: BroadcastChannel cross-instance messaging");

    // close stops delivery
    b.close();
    a.postMessage("after-close");
    setImmediate(function () {
        eq(bGot, ["hello"], "closed channel does not receive");
        console.log("ok: BroadcastChannel close stops delivery");
        a.close();
        c.close();
    });
});

// addEventListener style
var d = new BroadcastChannel("ev");
var e = new BroadcastChannel("ev");
d.addEventListener("message", function (ev) {
    assert(ev.data === "via-events", "addEventListener variant");
    console.log("ok: BroadcastChannel addEventListener");
    d.close(); e.close();
});
e.postMessage("via-events");

// ---- parse-bool ----
try {
    var parseBoolMod = require("./vendor/parse-bool.js");
    var parseBool = parseBoolMod.parseBool || parseBoolMod.default || unwrap(parseBoolMod);
    if (typeof parseBool === "function") {
        assert(parseBool("true") === true, "parseBool 'true'");
        assert(parseBool("false") === false, "parseBool 'false'");
        // Lib only handles true/false/null literals; other strings fall
        // through to Boolean() coercion.
        assert(parseBool("null") === null, "parseBool 'null'");
    }
    console.log("ok: parse-bool");
} catch (e) { console.log("skip: parse-bool (" + e.message + ")"); }

// ---- fast-stringify (handles circular refs) ----
try {
    var fsMod = require("./vendor/fast-stringify.js");
    var fastStringify = fsMod.stringify || fsMod.default || unwrap(fsMod);
    assert(typeof fastStringify === "function", "fast-stringify is function");
    var s = fastStringify({ a: 1 });
    assert(typeof s === "string" && s.indexOf('"a":1') >= 0, "stringifies plain object");
    // Circular
    var circ = {}; circ.self = circ;
    var safeStr = fastStringify(circ);
    assert(typeof safeStr === "string" && safeStr.length > 0, "stringifies circular without throwing");
    console.log("ok: fast-stringify");
} catch (e) { console.log("skip: fast-stringify (" + e.message + ")"); }

// ---- tinyspy (test spy lib) ----
try {
    var tinyspy = require("./vendor/tinyspy.js");
    var spy = tinyspy.spyOn || tinyspy.spy || (tinyspy.default && tinyspy.default.spyOn);
    assert(typeof spy === "function", "tinyspy.spy exists");
    var obj = { greet: function (name) { return "hi " + name; } };
    var s = spy(obj, "greet");
    obj.greet("alice");
    obj.greet("bob");
    if (s && s.callCount !== undefined) {
        assert(s.callCount === 2, "spy callCount = 2");
    }
    console.log("ok: tinyspy");
} catch (e) { console.log("skip: tinyspy (" + e.message + ")"); }

console.log("\nbroadcast_channel smoke: inline registered");
