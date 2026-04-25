// events.on async-iterator smoke.
// We can't use 'for await' (no async iteration syntax in SM45), so
// we drive the iterator manually via its .next() Promise.

var events = require("events");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof events.on === "function", "events.on present");

// Emit three values, then signal end via .return().
var ee = new events.EventEmitter();
var iter = events.on(ee, "data");
assert(typeof iter.next === "function", "iter.next");
assert(typeof iter["return"] === "function", "iter.return");

// Drain manually
var collected = [];

function step() {
    return iter.next().then(function (r) {
        if (r.done) return;
        collected.push(r.value[0]);
        if (collected.length >= 3) {
            // Signal end
            return iter["return"]();
        }
        return step();
    });
}

// Schedule emits via setImmediate so the iterator's next() is pending first.
setImmediate(function () { ee.emit("data", "alpha"); });
setImmediate(function () { ee.emit("data", "bravo"); });
setImmediate(function () { ee.emit("data", "charlie"); });

step().then(function () {
    assert(collected.length === 3, "got 3 values (got " + collected.length + ")");
    assert(collected[0] === "alpha", "first alpha");
    assert(collected[1] === "bravo", "second bravo");
    assert(collected[2] === "charlie", "third charlie");
    console.log("ok: events.on yields each emission");
}).catch(function (e) { console.error("FAIL: drain", e); process.exit(1); });

// Also test AbortSignal cancellation
var ee2 = new events.EventEmitter();
var c = new AbortController();
var iter2 = events.on(ee2, "x", { signal: c.signal });

iter2.next().then(
    function () { console.error("FAIL: expected abort rejection"); process.exit(1); },
    function (err) {
        assert(err && (err.name === "AbortError" || /abort/i.test(err.message || "")),
               "rejection looks like abort");
        console.log("ok: events.on AbortSignal cancellation");
    }
);

// Trigger abort
setImmediate(function () { c.abort(); });

// Error-event propagation
var ee3 = new events.EventEmitter();
var iter3 = events.on(ee3, "data");

iter3.next().then(
    function () { console.error("FAIL: expected error-event rejection"); process.exit(1); },
    function (err) {
        assert(err && err.message === "boom", "error event rejection");
        console.log("ok: events.on rejects on emitter 'error' event");
    }
);

setImmediate(function () { ee3.emit("error", new Error("boom")); });

console.log("\nevents_on smoke: inline registered (3 async assertions pending)");
