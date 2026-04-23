// string-template: `Hello {name}, you are {age}` interpolator.

var format = require("./vendor/string-template.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Object form.
eq(format("Hello {name}", { name: "World" }), "Hello World", "named");
eq(format("{a}+{b}={c}", { a: 1, b: 2, c: 3 }), "1+2=3", "multiple");

// Positional form.
eq(format("{0}, {1}, {0}", "A", "B"), "A, B, A", "positional");

// Missing key -> empty.
eq(format("{missing}", {}), "", "missing -> empty");
console.log("ok: string-template (4 cases)");

console.log("\nstring-template smoke: all assertions passed");
