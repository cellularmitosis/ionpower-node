// eventemitter2: hierarchical wildcard events.

var EE2 = require("./vendor/eventemitter2.js");
var EventEmitter2 = EE2.EventEmitter2 || EE2;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var em = new EventEmitter2({ wildcard: true, delimiter: "." });
var seen = [];
em.on("user.*", function (msg) { seen.push(msg); });
em.emit("user.login",  "alice");
em.emit("user.logout", "alice");
em.emit("other.event", "ignored");

assert(seen.length === 2, "wildcard match count: " + seen.length);
assert(seen[0] === "alice", "first arg");
console.log("ok: wildcard emit");

// listenerCount, once, etc.
var n = 0;
em.once("click", function () { n++; });
em.emit("click"); em.emit("click");
assert(n === 1, "once fires once");
console.log("ok: once");

console.log("\neventemitter2 smoke: all assertions passed");
