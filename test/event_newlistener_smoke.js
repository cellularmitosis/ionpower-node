// Regression test: EventEmitter must emit 'newListener' before adding,
// and 'removeListener' after removing. pacote's with-tarball-stream
// uses 'newListener' for an error-replay pattern that npm install
// depends on (otherwise tryExtract's promise never rejects, the
// surrounding tryDigest never falls through to trySpec, and the whole
// install hangs forever with "cb() never called").

var events = require("events");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- 'newListener' fires BEFORE the listener is added ---
var ee = new events.EventEmitter();
var newListenerCalls = [];
ee.on("newListener", function (ev, fn) {
    newListenerCalls.push({ ev: ev, fn: fn });
    // At this point, the listener should NOT be in the listeners array yet.
    if (ev === "data") {
        var listeners = ee.listeners("data");
        assert(listeners.length === 0,
               "newListener fires BEFORE add — got " + listeners.length + " listeners");
    }
});
function dataHandler () {}
ee.on("data", dataHandler);
assert(newListenerCalls.length === 1, "newListener fired once");
assert(newListenerCalls[0].ev === "data" && newListenerCalls[0].fn === dataHandler,
       "newListener got correct ev and fn");
console.log("ok: newListener fires before add");

// --- 'removeListener' fires AFTER the listener is removed ---
var ee2 = new events.EventEmitter();
var removeListenerCalls = [];
ee2.on("removeListener", function (ev, fn) {
    removeListenerCalls.push({ ev: ev, fn: fn });
});
function h () {}
ee2.on("data", h);
ee2.removeListener("data", h);
assert(removeListenerCalls.length === 1, "removeListener fired once");
assert(removeListenerCalls[0].ev === "data" && removeListenerCalls[0].fn === h,
       "removeListener got correct ev and fn");
console.log("ok: removeListener fires after remove");

// --- pacote's error-replay pattern ---
// The stream errors immediately. A late .on('error', ...) listener
// must still be invoked with the cached error.
var ee3 = new events.EventEmitter();
ee3.once("error", function (err) {
    ee3.on("newListener", function (ev, l) {
        if (ev === "error") l(err);
    });
});
var savedErr = new Error("simulated cache miss");
savedErr.code = "ENOENT";
ee3.emit("error", savedErr);
// Now (later) someone subscribes to error — should fire immediately.
var replayed = null;
ee3.on("error", function (err) { replayed = err; });
assert(replayed === savedErr, "late error subscriber received cached error");
console.log("ok: pacote-style error replay via newListener");

// --- 'newListener' itself doesn't recurse ---
// (Adding a 'newListener' listener should not trigger 'newListener'.)
var ee4 = new events.EventEmitter();
var depth = 0;
ee4.on("newListener", function () { depth++; });  // adding this should NOT fire 'newListener' itself
assert(depth === 0, "adding the 'newListener' listener doesn't fire 'newListener'");
console.log("ok: 'newListener' doesn't recurse");

console.log("\nevent_newlistener smoke: all assertions passed");
