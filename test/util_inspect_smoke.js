// Smoke: util.inspect depth/cycles/Maps/Sets/Dates/RegExps/Errors/functions.

var util = require("util");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(actual, expected, msg) {
    if (actual !== expected) {
        console.error("FAIL: " + (msg || '') + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
        process.exit(1);
    }
}

// Primitives.
eq(util.inspect(null), 'null', 'null');
eq(util.inspect(undefined), 'undefined', 'undefined');
eq(util.inspect(42), '42', 'number');
eq(util.inspect(true), 'true', 'boolean');
eq(util.inspect("hi"), "'hi'", 'string plain');
eq(util.inspect("it's\n\"ok\""), "'it\\'s\\n\"ok\"'", 'string escapes');
console.log("ok: primitives");

// Functions (named / anonymous).
function namedFn() {}
eq(util.inspect(namedFn), '[Function: namedFn]', 'named fn');
var anon = function() {};
var s = util.inspect(anon);
assert(s.indexOf('[Function') === 0, 'anon starts with [Function: ' + s);
console.log("ok: functions");

// Arrays.
eq(util.inspect([]), '[]', 'empty array');
eq(util.inspect([1, 2, 'x']), "[ 1, 2, 'x' ]", 'array of mixed');
console.log("ok: arrays");

// Objects.
eq(util.inspect({}), '{}', 'empty object');
eq(util.inspect({ a: 1, b: 'two' }), "{ a: 1, b: 'two' }", 'plain object');
console.log("ok: plain objects");

// Depth limit (default 2).
var nested = { a: { b: { c: { d: 1 } } } };
var deep2 = util.inspect(nested);
assert(deep2.indexOf('[Object]') >= 0, 'depth 2 should collapse to [Object]; got ' + deep2);
assert(util.inspect(nested, { depth: 5 }).indexOf('[Object]') < 0, 'depth 5 expands fully');
console.log("ok: depth limit");

// Cycles.
var cyc = { name: 'root' };
cyc.self = cyc;
var s2 = util.inspect(cyc);
assert(s2.indexOf('[Circular]') >= 0, 'cycle detection expected; got ' + s2);
console.log("ok: cycles");

// Dates.
var d = new Date(0);
eq(util.inspect(d), '1970-01-01T00:00:00.000Z', 'date ISO');
eq(util.inspect(new Date(NaN)), 'Invalid Date', 'invalid date');
console.log("ok: dates");

// RegExps.
eq(util.inspect(/foo/g), '/foo/g', 'regexp');
console.log("ok: regexps");

// Errors.
var e = new Error('boom');
var es = util.inspect(e);
assert(es.indexOf('Error: boom') === 0, "error starts with 'Error: boom'; got " + es);
// Stack line presence is best-effort (SM's stack format has @lines).
console.log("ok: errors");

// Maps and Sets.
if (typeof Map === 'function') {
    var m = new Map();
    m.set('a', 1); m.set('b', 2);
    var ms = util.inspect(m);
    assert(ms.indexOf('Map(2)') === 0, 'map header; got ' + ms);
    assert(ms.indexOf("'a' => 1") >= 0, "map entry 'a => 1'; got " + ms);
    console.log("ok: map");
}
if (typeof Set === 'function') {
    var st = new Set(); st.add(10); st.add(20);
    var ss = util.inspect(st);
    assert(ss.indexOf('Set(2)') === 0, 'set header; got ' + ss);
    assert(ss.indexOf('10') >= 0 && ss.indexOf('20') >= 0, 'set values; got ' + ss);
    console.log("ok: set");
}

// Uint8Array / Buffer-ish.
var u = new Uint8Array([1, 2, 3, 4]);
var us = util.inspect(u);
assert(us.indexOf('Uint8Array(4)') === 0, 'u8 header; got ' + us);
assert(us.indexOf('1, 2, 3, 4') >= 0, 'u8 contents; got ' + us);
console.log("ok: uint8array");

console.log("\nutil_inspect smoke: all assertions passed");
