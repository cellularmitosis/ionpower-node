// lower-case + upper-case: locale-aware-ish case converters (standalone).

// Use the non-locale variants — localeLowerCase requires a valid locale arg.
var lowerCase = require("./vendor/lower-case.js").lowerCase;
var upperCase = require("./vendor/upper-case.js").upperCase;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(lowerCase("Hello World"), "hello world", "lower");
eq(upperCase("hello world"), "HELLO WORLD", "upper");
console.log("ok: 2 case forms");

console.log("\ncase smoke: all assertions passed");
