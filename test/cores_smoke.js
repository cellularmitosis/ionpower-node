// Smoke test: the JS-level core modules bundled into the bridge.
// Exercises: events.EventEmitter, util.inherits, util.format, os.

var ee    = require("events").EventEmitter;
var util  = require("util");
var os    = require("os");
var child = require("child_process");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. EventEmitter basic.
var received = [];
var e1 = new ee();
e1.on("hi", function (x) { received.push(x); });
e1.emit("hi", "first");
e1.emit("hi", "second");
assert(received.length === 2 && received[0] === "first" && received[1] === "second",
       "EventEmitter two emits: got " + JSON.stringify(received));
console.log("ok: EventEmitter.on / emit");

// 2. once
var onceCount = 0;
e1.once("x", function () { onceCount++; });
e1.emit("x"); e1.emit("x");
assert(onceCount === 1, "once fires exactly once: got " + onceCount);
console.log("ok: EventEmitter.once");

// 3. removeListener
var touched = 0;
var fn = function () { touched++; };
e1.on("r", fn);
e1.emit("r");
e1.removeListener("r", fn);
e1.emit("r");
assert(touched === 1, "removeListener stops subsequent delivery");
console.log("ok: EventEmitter.removeListener");

// 4. util.inherits
function Dog(name) { ee.call(this); this.name = name; }
util.inherits(Dog, ee);
assert(Dog.super_ === ee, "util.inherits sets super_");
var d = new Dog("rex");
var barked = false;
d.on("bark", function () { barked = true; });
d.emit("bark");
assert(barked, "inherited EventEmitter works");
console.log("ok: util.inherits + inherited emit");

// 5. util.format
assert(util.format("%s/%d", "a", 42) === "a/42", "format %s %d");
assert(util.format("%j", { x: 1 }) === '{"x":1}',  "format %j");
assert(util.format("no specs") === "no specs",     "format plain");
assert(util.format("%%") === "%",                   "format %%");
console.log("ok: util.format");

// 6. util.inspect
assert(util.inspect(42) === "42",             "inspect number");
assert(util.inspect("a") === "'a'",            "inspect string");
assert(util.inspect(null) === "null",          "inspect null");
assert(util.inspect(undefined) === "undefined","inspect undefined");
assert(util.inspect([1,2]) === "[1,2]",        "inspect array");
console.log("ok: util.inspect");

// 7. os
assert(os.platform() === "darwin", "os.platform");
assert(os.arch() === "ppc",        "os.arch");
assert(os.tmpdir() === "/tmp",     "os.tmpdir");
assert(os.EOL === "\n",             "os.EOL");
assert(Array.isArray(os.cpus()) && os.cpus().length >= 1, "os.cpus");
console.log("ok: os basics");

// 8. child_process is a stub that throws
var caught = false;
try { child.spawn("echo"); } catch (e) { caught = true; }
assert(caught, "child_process.spawn throws");
console.log("ok: child_process stubs throw");

console.log("\ncores smoke: all assertions passed");
