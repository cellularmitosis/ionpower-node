// json-logic-js: rule engine driven by nested JSON arrays.

var jsonLogic = require("./vendor/json-logic-js.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Basic comparison.
eq(jsonLogic.apply({ "==": [1, 1] }), true, "1 == 1");
eq(jsonLogic.apply({ "==": [1, 2] }), false, "1 != 2");
console.log("ok: equality");

// Arithmetic.
eq(jsonLogic.apply({ "+": [2, 3] }), 5, "2 + 3 = 5");
eq(jsonLogic.apply({ "*": [4, 5] }), 20, "4 * 5 = 20");
console.log("ok: arithmetic");

// Vars from context.
var ctx = { age: 35, name: "alice" };
eq(jsonLogic.apply({ ">": [{ var: "age" }, 18] }, ctx), true, "var age > 18");
eq(jsonLogic.apply({ "var": "name" }, ctx), "alice", "var name");
console.log("ok: var");

// Nested logic.
var rule = {
    "if": [
        { ">=": [{ var: "age" }, 18] }, "adult",
        { ">=": [{ var: "age" }, 13] }, "teen",
        "kid"
    ]
};
eq(jsonLogic.apply(rule, { age: 10 }), "kid", "kid");
eq(jsonLogic.apply(rule, { age: 15 }), "teen", "teen");
eq(jsonLogic.apply(rule, { age: 40 }), "adult", "adult");
console.log("ok: nested if");

console.log("\njson-logic smoke: all assertions passed");
