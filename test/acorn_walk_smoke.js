// acorn-walk: AST walker companion to acorn. Visitor pattern on the
// nodes produced by `acorn.parse(...)`.

var acorn = require("./vendor/acorn.js");
var walkMod = require("./vendor/acorn-walk.js");
var walk = walkMod.default || walkMod;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var ast = acorn.parse("var x = 1; var y = 2; function foo() { return x + y; }", {
    ecmaVersion: 2020
});
assert(ast && ast.type === "Program", "parsed Program");

var identifiers = [];
// walk.full descends into every node; .simple only hits the first matching
// ancestor per branch and skips function-body bindings.
walk.full(ast, function (node) {
    if (node.type === "Identifier") identifiers.push(node.name);
});
assert(identifiers.indexOf("x") !== -1, "walked Identifier x");
assert(identifiers.indexOf("y") !== -1, "walked Identifier y");
assert(identifiers.indexOf("foo") !== -1, "walked Identifier foo");
console.log("ok: acorn-walk full visitor (" + identifiers.length + " idents)");

// ancestor walk also works.
var varDecls = 0;
walk.simple(ast, {
    VariableDeclaration: function () { varDecls++; }
});
assert(varDecls === 2, "2 VariableDeclaration; got " + varDecls);
console.log("ok: acorn-walk VariableDeclaration count");

console.log("\nacorn-walk smoke: all assertions passed");
