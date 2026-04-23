// jsonparse: streaming JSON parser (yields events).

var Parser = require("./vendor/jsonparse.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var p = new Parser();
var events = [];
p.onValue = function (v) {
    // onValue is called for each completed value, including the root.
    events.push({ key: this.key, value: v });
};

p.write('{"a":1,"b":[10,20,30]}');

// Root object is the last event.
var last = events[events.length - 1];
assert(last && last.value.a === 1, "root.a = 1");
assert(Array.isArray(last.value.b) && last.value.b[2] === 30, "root.b is [10,20,30]");
console.log("ok: streaming parse produced " + events.length + " events");

console.log("\njsonparse smoke: all assertions passed");
