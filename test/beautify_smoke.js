// Smoke test: js-beautify 1.14 on ionpower-node.
// js-beautify is a venerable code-formatter used before prettier
// took over. Another pretty-printer for comparison.

const mod = require("./vendor/js-beautify.js");
// UMD exports variably; handle both shapes.
const beautify = typeof mod === "function" ? mod : (mod.js_beautify || mod.js);

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

assert(typeof beautify === "function", "beautify is a function; mod shape = " + Object.keys(mod).join(","));

// Reformat a compact function.
var messy = "function hi(name){if(!name){name='world'}return 'hello, '+name}";
var pretty = beautify(messy, { indent_size: 2 });
console.log(pretty);
assert(pretty.indexOf("function hi(name) {") >= 0, "braces have spaces");
assert(pretty.indexOf("  if (!name) {")       >= 0, "if has space");
console.log("ok: function reformat");

// A JSON-ish object literal.
var obj = "{a:1,b:'hi',c:[1,2,3]}";
var p2 = beautify(obj, { indent_size: 4 });
assert(p2.indexOf("\n    a: 1,") >= 0, "object key indented; got:\n" + p2);
console.log("ok: object literal");

// Already-pretty is idempotent.
var idem = beautify(pretty, { indent_size: 2 });
assert(idem === pretty, "idempotent reformat");
console.log("ok: idempotent on already-pretty input");

console.log("\njs-beautify smoke: all assertions passed");
