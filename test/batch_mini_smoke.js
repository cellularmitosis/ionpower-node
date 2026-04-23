// Mini-batch: delay@6, abstract-logging, compact2string, stringify-
// attributes.

var delayMod = require("./vendor/delay-v6.js");
var delay = delayMod.default || delayMod;
var absLog = require("./vendor/abstract-logging.js");
var compact2string = require("./vendor/compact2string.js");
var stringifyAttrsMod = require("./vendor/stringify-attributes.js");
var stringifyAttrs = stringifyAttrsMod.default || stringifyAttrsMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); } }

// delay@6
var p = delay(10);
assert(p && typeof p.then === "function", "delay@6 returns thenable");
console.log("ok: delay@6");

// abstract-logging
assert(typeof absLog === "object", "abstract-logging is object");
assert(typeof absLog.info === "function", "abstract-logging.info");
absLog.info("test");  // no-op
console.log("ok: abstract-logging");

// compact2string: IP:port -> host:port shorthand.
var ipPort = Buffer.from([10, 0, 0, 1, 0x1f, 0x90]);  // 10.0.0.1:8080
var addr = compact2string(ipPort);
assert(addr.indexOf("10.0.0.1") !== -1 && addr.indexOf("8080") !== -1,
       "compact2string: " + addr);
console.log("ok: compact2string");

// stringify-attributes
var out = stringifyAttrs({ id: "hello", class: "one two", "data-count": 3 });
assert(out.indexOf('id="hello"') !== -1, "id attr");
assert(out.indexOf('data-count="3"') !== -1, "data-count attr");
console.log("ok: stringify-attributes");

console.log("\nbatch_mini smoke: all assertions passed");
