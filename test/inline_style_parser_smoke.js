// inline-style-parser: parse a CSS-ish `style="color: red; margin: 0"`
// string into an AST of declarations.

var parse = require("./vendor/inline-style-parser.js");
parse = parse.default || parse;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var decls = parse("color: red; margin: 0; font-size: 14px;");
assert(Array.isArray(decls), "returns array");
assert(decls.length === 3, "3 decls; got " + decls.length);

var byProp = {};
decls.forEach(function (d) {
    if (d.type === "declaration") byProp[d.property] = d.value;
});
assert(byProp.color === "red",         "color: red");
assert(byProp.margin === "0",          "margin: 0");
assert(byProp["font-size"] === "14px", "font-size: 14px");
console.log("ok: inline-style-parser (3 decls)");

console.log("\ninline-style-parser smoke: all assertions passed");
