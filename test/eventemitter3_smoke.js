// eventemitter3: much faster event emitter (browser-leaning).

var EE3 = require("./vendor/eventemitter3.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// UMD exposes EventEmitter3 global or module.exports — normalize.
var EventEmitter = EE3.EventEmitter || EE3;

var em = new EventEmitter();
var seen = [];
em.on("ping", function (a, b) { seen.push(["ping", a, b]); });
em.emit("ping", 1, 2);
em.emit("ping", 3, 4);
assert(seen.length === 2, "emit x2 captured: " + seen.length);
console.log("ok: on/emit");

// Return value: emit returns bool whether any listener.
var r = em.emit("nobody-home");
assert(r === false, "no-listener emit returns false");
console.log("ok: emit returns false when no listeners");

// once
var oc = 0;
em.once("go", function () { oc++; });
em.emit("go"); em.emit("go");
assert(oc === 1, "once fires once");
console.log("ok: once");

// removeListener
function h1() { seen.push("h1"); }
em.on("x", h1);
em.emit("x");
em.removeListener("x", h1);
em.emit("x");
assert(seen.indexOf("h1") >= 0 && seen.lastIndexOf("h1") === seen.indexOf("h1"),
       "removeListener removed h1");
console.log("ok: removeListener");

// listenerCount
em.on("y", function () {}); em.on("y", function () {});
assert(em.listenerCount("y") === 2, "listenerCount");
console.log("ok: listenerCount");

console.log("\neventemitter3 smoke: all assertions passed");
