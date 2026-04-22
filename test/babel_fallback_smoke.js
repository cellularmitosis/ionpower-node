// Smoke: transparent transpile-on-require. The vendored modern_sample.js
// uses ?. / ?? / object spread — none of which parse on SM45 directly.
// On SyntaxError during require, our runtime should reach for
// @babel/standalone, lower to ES5, and re-evaluate. Caller sees a working
// module.
//
// Opt-out: IONPOWER_NO_BABEL=1 disables the hook (expected failure path).

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var t0 = Date.now();
var m = require("./vendor/modern_sample.js");
console.log("loaded modern sample via babel fallback in " +
            (Date.now() - t0) + " ms");

assert(typeof m === 'object' && m !== null,
       "module exports missing");
assert(m.deep() === 'deep',
       "optional chaining yielded wrong value: " + m.deep());
assert(m.total() === 14,
       "1+4+9 = 14, got: " + m.total());

var sp = m.spread();
assert(sp.y === 2 && sp.z === 3 && sp.a.b.c === 'deep',
       "object spread result wrong: " + JSON.stringify(sp));

assert(m.label() === '> anon',
       "label() default wrong: " + m.label());
assert(m.label({ name: 'imacg52' }) === '> imacg52',
       "label({name}) wrong: " + m.label({ name: 'imacg52' }));
assert(m.label({ prefix: '#', name: 'x' }) === '# x',
       "label({prefix,name}) wrong: " + m.label({ prefix: '#', name: 'x' }));

// Second require() pulls from require cache — no second transpile cost.
var t1 = Date.now();
var m2 = require("./vendor/modern_sample.js");
var dt = Date.now() - t1;
assert(m2 === m, "second require returned different module object");
console.log("ok: cache hit returned same exports (took " + dt + " ms)");

console.log("\nbabel_fallback_smoke: all assertions passed");
