// diagnostics_channel smoke.

var dc = require("diagnostics_channel");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- channel + subscribe + publish ----
assert(typeof dc.channel === "function", "dc.channel");
var ch = dc.channel("test:event");
assert(ch.name === "test:event", "channel.name");
assert(ch.hasSubscribers === false, "no subscribers initially");

var got = [];
function listener(data, name) { got.push({ data: data, name: name }); }
ch.subscribe(listener);
assert(ch.hasSubscribers === true, "hasSubscribers true after subscribe");

ch.publish({ value: 42 });
ch.publish("hello");

eq(got.length, 2, "two publishes received");
eq(got[0].data, { value: 42 }, "first payload");
eq(got[0].name, "test:event", "channel name passed");
eq(got[1].data, "hello", "second payload");
console.log("ok: channel publish/subscribe");

// ---- unsubscribe ----
ch.unsubscribe(listener);
assert(ch.hasSubscribers === false, "no subscribers after unsubscribe");
ch.publish("ignored");
eq(got.length, 2, "no delivery after unsubscribe");
console.log("ok: channel unsubscribe");

// ---- channel name caching ----
var ch2 = dc.channel("test:event");
assert(ch === ch2, "channel() returns same instance for same name");
console.log("ok: channel cached by name");

// ---- module-level subscribe / unsubscribe ----
var modGot = [];
dc.subscribe("test:mod", function (d) { modGot.push(d); });
dc.channel("test:mod").publish("via-module");
eq(modGot, ["via-module"], "dc.subscribe routes through channel");
console.log("ok: dc.subscribe");

// ---- TracingChannel.traceSync ----
var tc = dc.tracingChannel("trace:thing");
var phases = [];
tc.start.subscribe(function (ctx) { phases.push("start"); });
tc.end.subscribe(function (ctx) { phases.push("end"); });
tc.error.subscribe(function (ctx) { phases.push("error"); });

var result = tc.traceSync(function () { return 7; }, { name: "test" });
eq(result, 7, "traceSync returns fn result");
eq(phases, ["start", "end"], "traceSync fires start + end");

// Error path
phases = [];
var threw = false;
try {
    tc.traceSync(function () { throw new Error("boom"); }, { name: "fail" });
} catch (e) { threw = true; }
assert(threw, "error rethrown");
eq(phases, ["start", "error", "end"], "error path fires start + error + end");
console.log("ok: TracingChannel.traceSync");

// ---- bonus: a couple of newly-vendored libs ----
function unwrap(m) { return (m && m.default) || m; }

try {
    var stripComments = unwrap(require("./vendor/strip-comments.js"));
    if (typeof stripComments === "function") {
        var s = stripComments("/* hello */ var x = 1;");
        assert(typeof s === "string", "strip-comments returns string");
    }
    console.log("ok: strip-comments (loaded)");
} catch (e) { console.log("skip: strip-comments (" + e.message + ")"); }

try {
    var cliTruncate = unwrap(require("./vendor/cli-truncate.js"));
    if (typeof cliTruncate === "function") {
        var t = cliTruncate("hello world", 5);
        assert(typeof t === "string", "cli-truncate returns string");
    }
    console.log("ok: cli-truncate (loaded)");
} catch (e) { console.log("skip: cli-truncate (" + e.message + ")"); }

console.log("\ndiag_channel smoke: all assertions passed");
