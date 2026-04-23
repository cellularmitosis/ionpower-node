// twig.js: port of the Twig (Symfony) template language. Used by
// drupal-ish CMS and docs stacks. Significantly larger than mustache
// but with conditionals / loops / filters.

var TwigMod = require("./vendor/twig.js");
var Twig = TwigMod.default || TwigMod.Twig || TwigMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// twig({ data: "..." }).render(ctx).
var tpl = Twig.twig({ data: "Hello {{ name }}!" });
eq(tpl.render({ name: "World" }), "Hello World!", "simple interpolation");
console.log("ok: twig simple interpolation");

var loop = Twig.twig({ data: "{% for n in nums %}{{ n }}{% endfor %}" });
eq(loop.render({ nums: [1, 2, 3, 4, 5] }), "12345", "for loop");
console.log("ok: twig for loop");

var cond = Twig.twig({ data: "{% if age >= 18 %}adult{% else %}minor{% endif %}" });
eq(cond.render({ age: 21 }), "adult", "if true branch");
eq(cond.render({ age: 10 }), "minor", "if else branch");
console.log("ok: twig conditionals");

// Filter: upper.
var filt = Twig.twig({ data: "{{ s | upper }}" });
eq(filt.render({ s: "hello" }), "HELLO", "upper filter");
console.log("ok: twig upper filter");

console.log("\ntwig smoke: all assertions passed");
