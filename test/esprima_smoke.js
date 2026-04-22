// Smoke test: esprima 4.0.1 (JS parser) on ionpower-node.
// Companion to acorn — different parser, different AST node names,
// same job. Confirms two full JS parsers run on PPC.

const esprima = require("./vendor/esprima.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// parseScript — script-level source (no modules).
var ast = esprima.parseScript("var x = 1 + 2; function f(n) { return n * 2; }");
assert(ast.type === "Program", "root is Program");
assert(ast.body.length === 2, "two top-level stmts");
assert(ast.body[0].type === "VariableDeclaration", "stmt 0 is VariableDeclaration");
assert(ast.body[1].type === "FunctionDeclaration", "stmt 1 is FunctionDeclaration");
console.log("ok: simple parse");

// parseModule (with import/export)
var mod = esprima.parseModule("export const x = 42;");
assert(mod.type === "Program", "module root is Program");
assert(mod.sourceType === "module", "sourceType is module");
assert(mod.body[0].type === "ExportNamedDeclaration", "ExportNamedDeclaration node");
console.log("ok: module parse");

// tokenize
var tokens = esprima.tokenize("a + b * 2");
assert(tokens.length === 5, "5 tokens for 'a + b * 2', got " + tokens.length);
assert(tokens[0].type === "Identifier" && tokens[0].value === "a", "token 0");
assert(tokens[1].type === "Punctuator" && tokens[1].value === "+", "token 1");
console.log("ok: tokenize");

// Error with range/loc info.
var caught = null;
try { esprima.parseScript("function ( { ", { loc: true }); }
catch (e) { caught = e; }
assert(caught && typeof caught.message === "string", "throws SyntaxError-like");
assert(typeof caught.lineNumber === "number", "error has lineNumber");
console.log("ok: parse error reports line");

// Self-parse
var fs = require("fs");
var src = fs.readFileSync("test/vendor/esprima.js", "utf8");
console.log("self-parsing esprima.js (" + src.length + " bytes)...");
var t0 = Date.now();
var selfAst = esprima.parseScript(src);
var t1 = Date.now();
assert(selfAst.type === "Program", "self-parse is a Program");
console.log("ok: self-parse in " + (t1 - t0) + " ms");
console.log("    top-level stmts: " + selfAst.body.length);

console.log("\nesprima smoke: all assertions passed");
