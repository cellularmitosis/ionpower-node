// Case (Nathan Bubna): omnibus case-conversion library. Unlike our
// single-purpose lower-case / upper-case modules (see case_smoke.js),
// Case provides the full snake/camel/pascal/kebab/constant family.

var Case = require("./vendor/case.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(Case.upper("hello world"),   "HELLO WORLD",   "upper");
eq(Case.lower("HELLO WORLD"),   "hello world",   "lower");
eq(Case.capital("hello world"), "Hello World",   "capital (title-case)");
eq(Case.snake("helloWorld"),    "hello_world",   "snake");
eq(Case.camel("hello_world"),   "helloWorld",    "camel");
eq(Case.pascal("hello_world"),  "HelloWorld",    "pascal");
eq(Case.kebab("helloWorld"),    "hello-world",   "kebab");
eq(Case.constant("helloWorld"), "HELLO_WORLD",   "constant");
console.log("ok: Case (8 transforms)");

console.log("\ncase-lib smoke: all assertions passed");
