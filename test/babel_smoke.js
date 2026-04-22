// Smoke test: @babel/standalone 7.23.9 on ionpower-node.
// Babel is the Swiss-army-knife transpiler. 2.8 MB bundle.
// If this loads, we can transpile modern JS down to ES5 and run it
// on SpiderMonkey 45 — the escape hatch for libs that use ?. or ??.

var t0 = Date.now();
var Babel = require("./vendor/babel.js");
console.log("loaded @babel/standalone v" + Babel.version +
            " in " + (Date.now() - t0) + " ms");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Transpile optional chaining (ES2020) down to ES5.
var src1 = "const x = { a: { b: 42 } }; export const y = x?.a?.b;";
var s1 = Date.now();
var out1 = Babel.transform(src1, { presets: ["env"] });
console.log("transform 1 (?. -> ES5) in " + (Date.now() - s1) + " ms");
console.log(out1.code);
assert(out1.code.indexOf("?.") < 0,
       "optional chaining should be lowered; got:\n" + out1.code);
assert(out1.code.indexOf("var x") >= 0 || out1.code.indexOf("_x.a") >= 0,
       "expected ES5-style output");
console.log("ok: optional chaining transpiled away");

// 2. Transpile nullish coalescing and a class.
var src2 = [
    "class Greet {",
    "  constructor(name) { this.name = name ?? 'world'; }",
    "  hi() { return `hello, ${this.name}`; }",
    "}",
    "export const g = new Greet();"
].join("\n");
var s2 = Date.now();
var out2 = Babel.transform(src2, { presets: ["env"] });
console.log("\ntransform 2 (class+??+template) in " + (Date.now() - s2) + " ms");
console.log(out2.code);
assert(out2.code.indexOf("??") < 0,  "nullish coalescing lowered");
// Only care that there's no `class Greet` declaration — babel may still
// have string literals referencing "class" in helpers.
assert(!/class\s+Greet\b/.test(out2.code), "class Greet declaration lowered to function");
console.log("ok: class + nullish coalescing transpiled");

// 3. The real goal: transpile-then-execute. Take modern code, lower it,
// eval the result in this runtime, see that it works.
var src3 =
    "const arr = [1, 2, 3].map(x => x ** 2);\n" +
    "const total = arr.reduce((a, b) => a + b, 0);\n" +
    "module.exports = { arr: arr, total: total };\n";
var out3 = Babel.transform(src3, { presets: ["env"] });
var mod = { exports: {} };
(function (module, exports) { eval(out3.code); })(mod, mod.exports);
assert(mod.exports.total === 14,
       "transpiled-then-eval: 1+4+9 should be 14, got " + mod.exports.total);
console.log("ok: transpiled code executes, yields total=14");

console.log("\nbabel-standalone smoke: all assertions passed");
