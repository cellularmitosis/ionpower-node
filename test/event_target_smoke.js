// EventTarget / Event / CustomEvent global smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- Globals exposed ----
assert(typeof Event === "function", "Event ctor present");
assert(typeof CustomEvent === "function", "CustomEvent ctor present");
assert(typeof EventTarget === "function", "EventTarget ctor present");
console.log("ok: Event / CustomEvent / EventTarget globals");

// ---- new Event basic ----
var e = new Event("click", { bubbles: true, cancelable: true });
eq(e.type, "click", "Event.type");
assert(e.bubbles === true, "Event.bubbles");
assert(e.cancelable === true, "Event.cancelable");
assert(e.defaultPrevented === false, "default not prevented");
e.preventDefault();
assert(e.defaultPrevented === true, "preventDefault works");
console.log("ok: new Event + preventDefault");

// ---- new CustomEvent with detail ----
var ce = new CustomEvent("ping", { detail: { x: 1 } });
eq(ce.type, "ping", "CustomEvent type");
assert(ce.detail && ce.detail.x === 1, "CustomEvent detail");
assert(ce instanceof Event, "CustomEvent extends Event");
console.log("ok: CustomEvent + detail");

// ---- EventTarget add/remove/dispatch ----
var et = new EventTarget();
var fired = 0;
function listener(ev) { fired++; eq(ev.type, "tick", "listener got 'tick'"); }
et.addEventListener("tick", listener);
var ev = new Event("tick");
var notPrevented = et.dispatchEvent(ev);
eq(notPrevented, true, "dispatch returns true (not prevented)");
eq(fired, 1, "listener fired once");
et.dispatchEvent(new Event("tick"));
eq(fired, 2, "listener fires again");

// Remove listener
et.removeEventListener("tick", listener);
et.dispatchEvent(new Event("tick"));
eq(fired, 2, "removed listener stops firing");
console.log("ok: EventTarget add/remove/dispatch");

// ---- once option ----
var et2 = new EventTarget();
var onceFired = 0;
et2.addEventListener("x", function (e) { onceFired++; }, { once: true });
et2.dispatchEvent(new Event("x"));
et2.dispatchEvent(new Event("x"));
eq(onceFired, 1, "once option fires only once");
console.log("ok: addEventListener once option");

// ---- preventDefault returns false from dispatch ----
var et3 = new EventTarget();
et3.addEventListener("y", function (e) { e.preventDefault(); });
var ev3 = new Event("y", { cancelable: true });
var ret = et3.dispatchEvent(ev3);
eq(ret, false, "dispatch returns false when prevented");
console.log("ok: preventDefault flips dispatchEvent return");

// ---- stopImmediatePropagation ----
var et4 = new EventTarget();
var calls = [];
et4.addEventListener("z", function () { calls.push(1); });
et4.addEventListener("z", function (e) { calls.push(2); e.stopImmediatePropagation(); });
et4.addEventListener("z", function () { calls.push(3); });
et4.dispatchEvent(new Event("z"));
eq(JSON.stringify(calls), "[1,2]", "stopImmediatePropagation skips later listeners");
console.log("ok: stopImmediatePropagation");

// ---- handleEvent object form ----
var et5 = new EventTarget();
var ho = { handleEvent: function (e) { ho.got = e.type; } };
et5.addEventListener("hi", ho);
et5.dispatchEvent(new Event("hi"));
eq(ho.got, "hi", "handleEvent object form");
console.log("ok: addEventListener with handleEvent object");

console.log("\nevent_target smoke: all assertions passed");
