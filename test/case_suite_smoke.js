// camelCase / constantCase / paramCase / dotCase / pascalCase.
// Each bare-requires tslib + no-case (+ upper-case for constant).
// Validates vendor-resolver on a four-deep bare-require chain.

var camelMod = require("./vendor/camel-case.js");
var constMod = require("./vendor/constant-case.js");
var paramMod = require("./vendor/param-case.js");
var dotMod   = require("./vendor/dot-case.js");
var pascalMod = require("./vendor/pascal-case.js");

var camelCase = camelMod.camelCase || camelMod.default || camelMod;
var constantCase = constMod.constantCase || constMod.default || constMod;
var paramCase = paramMod.paramCase || paramMod.default || paramMod;
var dotCase = dotMod.dotCase || dotMod.default || dotMod;
var pascalCase = pascalMod.pascalCase || pascalMod.default || pascalMod;

function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); } }

eq(camelCase("hello world"),    "helloWorld",   "camelCase");
eq(constantCase("hello world"), "HELLO_WORLD",  "constantCase");
eq(paramCase("helloWorld"),     "hello-world",  "paramCase");
eq(dotCase("hello world"),      "hello.world",  "dotCase");
eq(pascalCase("hello world"),   "HelloWorld",   "pascalCase");
console.log("ok: 5 case converters");

console.log("\ncase_suite smoke: all assertions passed");
