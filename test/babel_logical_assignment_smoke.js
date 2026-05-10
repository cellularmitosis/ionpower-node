// ES2021 logical-assignment operators (||=, &&=, ??=) require lowering
// to run on SM45. Our @babel/preset-env config (targets: ie 11) plus the
// explicit transform-logical-assignment-operators plugin should cover it
// transparently when require()-ing a file that contains them.
//
// If this smoke fails with a SyntaxError on require(), the Babel
// fallback didn't emit a working transform — most likely the explicit
// plugin reference in src/node_compat/globals.cpp's babel.transform
// call has regressed.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var t0 = Date.now();
var m = require("./vendor/logical_assignment_sample.js");
console.log("loaded logical-assignment sample via babel fallback in " +
            (Date.now() - t0) + " ms");

assert(typeof m === 'object' && m !== null, "module exports missing");

// ||= : assign only when LHS is falsy.
assert(m.orAssign(null,      'fallback') === 'fallback', "||= assigns when null");
assert(m.orAssign(0,         'fallback') === 'fallback', "||= assigns when 0");
assert(m.orAssign('',        'fallback') === 'fallback', "||= assigns when ''");
assert(m.orAssign('present', 'fallback') === 'present',  "||= keeps truthy");
console.log("ok: ||= semantics");

// &&= : assign only when LHS is truthy.
assert(m.andAssign(1,    'replacement') === 'replacement', "&&= assigns when truthy");
assert(m.andAssign(null, 'replacement') === null,          "&&= skips null");
assert(m.andAssign(0,    'replacement') === 0,             "&&= skips 0");
assert(m.andAssign('',   'replacement') === '',            "&&= skips ''");
console.log("ok: &&= semantics");

// ??= : assign only when LHS is null/undefined (but NOT 0 / '' / false).
assert(m.nullishAssign(null,      'fallback') === 'fallback', "??= assigns when null");
assert(m.nullishAssign(undefined, 'fallback') === 'fallback', "??= assigns when undefined");
assert(m.nullishAssign(0,         'fallback') === 0,          "??= keeps 0");
assert(m.nullishAssign('',        'fallback') === '',         "??= keeps ''");
assert(m.nullishAssign(false,     'fallback') === false,      "??= keeps false");
console.log("ok: ??= semantics");

console.log("\nbabel_logical_assignment_smoke: all assertions passed");
