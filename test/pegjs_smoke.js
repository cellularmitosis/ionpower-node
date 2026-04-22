// Smoke test: PEG.js 0.10 (parser generator) on ionpower-node.
// Another runtime-codegen pattern: user gives a grammar string, PEG.js
// generates a parser function, we run it.

const peg = require("./vendor/pegjs.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Grammar for a tiny arithmetic expression calculator.
var grammar = [
    "Expression = head:Term tail:(_ ('+' / '-') _ Term)* {",
    "  return tail.reduce(function(a, b) {",
    "    if (b[1] === '+') return a + b[3];",
    "    return a - b[3];",
    "  }, head);",
    "}",
    "Term = head:Factor tail:(_ ('*' / '/') _ Factor)* {",
    "  return tail.reduce(function(a, b) {",
    "    if (b[1] === '*') return a * b[3];",
    "    return a / b[3];",
    "  }, head);",
    "}",
    "Factor = '(' _ expr:Expression _ ')' { return expr; }",
    "  / Integer",
    "Integer 'integer' = [0-9]+ { return parseInt(text(), 10); }",
    "_ 'whitespace' = [ \\t\\n\\r]*",
].join("\n");

var parser = peg.generate(grammar);
assert(typeof parser.parse === "function", "parser.parse exists");
console.log("ok: grammar compiled to parser");

assert(parser.parse("2 + 3") === 5,                 "2 + 3");
assert(parser.parse("10 - 4 * 2") === 2,            "10 - 4 * 2 (prec)");
assert(parser.parse("(1 + 2) * 3") === 9,           "(1 + 2) * 3 (parens)");
assert(parser.parse("100 / 4 / 5") === 5,           "left-assoc div");
assert(parser.parse("7") === 7,                      "single int");
console.log("ok: expressions evaluate correctly");

// Syntax error reporting.
var threw = false;
try { parser.parse("2 +"); } catch (e) {
    threw = true;
    assert(typeof e.location === "object", "error has .location");
    assert(typeof e.message === "string",  "error has .message");
}
assert(threw, "bad input throws");
console.log("ok: syntax error reporting");

console.log("\npegjs smoke: all assertions passed");
