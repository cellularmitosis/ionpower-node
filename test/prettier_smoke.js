// Smoke test: prettier 2.8.8 on ionpower-node.
// Heavy CPU: parses JS to AST, pretty-prints via Oppen-style document
// model, emits formatted output. Two modules to load (prettier standalone
// + babel parser plugin) — a modest test of require chaining.

const prettier = require("./vendor/prettier.js");
const babel    = require("./vendor/prettier-parser-babel.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Trivial reformat.
var messy = "const x={ a:1,b :2, c  :   3 };function f (x, y){return x+y}";
var t0 = Date.now();
var tidy = prettier.format(messy, {
    parser: "babylon",
    plugins: [babel],
    printWidth: 40
});
var t1 = Date.now();
console.log("format small snippet in", (t1 - t0), "ms:");
console.log(tidy);
assert(tidy.indexOf("const x = {") >= 0, "expected 'const x = {' in output");
assert(tidy.indexOf("function f(x, y)") >= 0, "function reformatted");

// 2. A longer realistic function.
var input = [
    "function fibonacci(n){if(n<2)return n;let a=0,b=1;for(let i=2;i<=n;i++){",
    "const c=a+b;a=b;b=c;}return b;}",
    "const arr=[1,2,3,4,5].map((x)=>x*x).filter(x=>x>4).reduce((a,b)=>a+b,0);",
    "module.exports={fibonacci,arr};"
].join("");
var s2 = Date.now();
var out2 = prettier.format(input, {
    parser: "babylon",
    plugins: [babel],
    printWidth: 60
});
var e2 = Date.now();
console.log("\nformat realistic input in", (e2 - s2), "ms:");
console.log(out2);
assert(out2.split("\n").length > 5, "multiline output (was compacted on one line?)");
assert(out2.indexOf("function fibonacci") >= 0, "function body intact");

console.log("\nprettier smoke: all assertions passed");
console.log("version:", prettier.version);
