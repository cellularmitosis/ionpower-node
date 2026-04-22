// tiny-emitter: 200-byte event emitter, event-bus style.

var E = require("./vendor/tiny-emitter.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var em = new E();
var seen = [];
em.on("hi", function (a, b) { seen.push(["hi", a, b]); });
em.emit("hi", 1, 2);
em.emit("hi", 3, 4);
assert(seen.length === 2 && seen[0][1] === 1 && seen[1][2] === 4,
       "two emits captured: " + JSON.stringify(seen));
console.log("ok: on/emit");

var oseen = [];
em.once("once-only", function (x) { oseen.push(x); });
em.emit("once-only", "a");
em.emit("once-only", "b");
assert(oseen.length === 1 && oseen[0] === "a", "once only fires once");
console.log("ok: once");

em.off("hi");
em.emit("hi", 9, 9);
assert(seen.length === 2, "off prevents further emits");
console.log("ok: off");

console.log("\ntiny-emitter smoke: all assertions passed");
