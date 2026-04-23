// pupa: {name}-style template interpolation with HTML escape.

var pupaMod = require("./vendor/pupa.js");
var pupa = pupaMod.default || pupaMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(pupa("Hello, {name}!", { name: "World" }), "Hello, World!", "simple");
eq(pupa("{a} + {b} = {c}", { a: 1, b: 2, c: 3 }), "1 + 2 = 3", "multiple");
// Double-brace form auto-HTML-escapes.
eq(pupa("{{value}}", { value: "<script>" }),
   "&lt;script&gt;", "double-brace escapes");
console.log("ok: pupa");

console.log("\npupa smoke: all assertions passed");
