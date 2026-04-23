// astring: generate JavaScript source from an ESTree/acorn AST.
// Pairs with acorn + acorn-walk. If you parse, transform, then
// print — astring is the "print" step.

var acorn = require("./vendor/acorn.js");
var astringMod = require("./vendor/astring.js");
var generate = astringMod.generate || astringMod.default || astringMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Round-trip: parse -> generate.
var src = "var x = 1 + 2;\nvar y = x * 3;\n";
var ast = acorn.parse(src, { ecmaVersion: 2020 });
var out = generate(ast);
assert(out.indexOf("var x") !== -1, "contains var x");
assert(out.indexOf("1 + 2") !== -1, "contains 1 + 2");
assert(out.indexOf("var y") !== -1, "contains var y");
assert(out.indexOf("x * 3") !== -1, "contains x * 3");
console.log("ok: astring round-trips parse -> generate");

// Transform: change "1" to "99", re-emit.
// astring prefers node.raw over node.value when present (for fidelity),
// so we set both.
function transformOne(node) {
    if (node.type === "Literal" && node.value === 1) {
        node.value = 99;
        if ("raw" in node) node.raw = "99";
    }
    for (var k in node) {
        var v = node[k];
        if (v && typeof v === "object" && k !== "loc") {
            if (Array.isArray(v)) v.forEach(transformOne);
            else if (v.type) transformOne(v);
        }
    }
}
transformOne(ast);
var out2 = generate(ast);
assert(out2.indexOf("99") !== -1, "transform surfaced: " + out2);
console.log("ok: astring parse -> transform -> generate");

console.log("\nastring smoke: all assertions passed");
