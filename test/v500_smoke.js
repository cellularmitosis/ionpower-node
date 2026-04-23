// Push to 500: defaults, stubs, amdefine, browser-stdout,
// json-stringify-nice, parse-headers.

// defaults@3 uses structuredClone which SM45 doesn't expose; skip.
var stubs = require("./vendor/stubs.js");
var amdefine = require("./vendor/amdefine.js");
var browserStdout = require("./vendor/browser-stdout.js");
var jsonStringifyNiceMod = require("./vendor/json-stringify-nice.js");
var jsonStringifyNice = jsonStringifyNiceMod.default || jsonStringifyNiceMod;
var parseHeaders = require("./vendor/parse-headers.js");
parseHeaders = parseHeaders.default || parseHeaders;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// defaults@3 is vendored but needs structuredClone — skip test.

// stubs: method-stubbing testing helper. Expects (obj, method, cfg, stub).
assert(typeof stubs === "function", "stubs is a function");
var target = { greet: function () { return "hi"; } };
var restore = stubs(target, "greet", function () { return "stubbed"; });
assert(target.greet() === "stubbed", "greet stubbed");
if (typeof restore === "function") restore();
console.log("ok: stubs");

// amdefine.
assert(typeof amdefine === "function", "amdefine is a function");
console.log("ok: amdefine");

// browser-stdout: a Writable stub for browser-side test runners.
var bs = browserStdout();
assert(typeof bs.write === "function", "browserStdout has write");
bs.write("hello");
console.log("ok: browser-stdout");

// json-stringify-nice: deterministic key order.
var out = jsonStringifyNice({ b: 2, a: 1, c: 3 });
var obj = JSON.parse(out);
eq(Object.keys(obj), ["a", "b", "c"], "keys sorted");
console.log("ok: json-stringify-nice");

// parse-headers: parse HTTP header block into object.
var h = parseHeaders("Content-Type: text/html\r\nSet-Cookie: foo=bar\r\n");
assert(h["content-type"] === "text/html", "parsed content-type");
assert(h["set-cookie"] === "foo=bar" || Array.isArray(h["set-cookie"]),
       "parsed set-cookie: " + JSON.stringify(h["set-cookie"]));
console.log("ok: parse-headers");

console.log("\nv500 smoke: all assertions passed");
