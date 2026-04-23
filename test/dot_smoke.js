// doT.js: fast small templating engine.

var dot = require("./vendor/dot.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Simple interpolation.
var t1 = dot.template("Hello {{=it.name}}!");
eq(t1({ name: "Tiger" }), "Hello Tiger!", "interp");
console.log("ok: {{=it.name}}");

// Loop.
var t2 = dot.template("{{~it.items :item:i}}<li>{{=item}}</li>{{~}}");
eq(t2({ items: ["a", "b", "c"] }), "<li>a</li><li>b</li><li>c</li>", "loop");
console.log("ok: loop");

// Conditional.
var t3 = dot.template("{{?it.x > 10}}big{{??}}small{{?}}");
eq(t3({ x: 20 }), "big", "if big");
eq(t3({ x: 5 }),  "small", "else small");
console.log("ok: if/else");

console.log("\ndoT smoke: all assertions passed");
