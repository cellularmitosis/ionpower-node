// Smoke test: acorn (ES5-compatible JS parser) on ionpower-node.
// Parses a few snippets, then — for the bootstrap test — parses its
// own source.

const fs    = require("fs");
const path  = require("path");
const acorn = require("./vendor/acorn.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Tiny program round-trip: parse a couple of statements.
var ast = acorn.parse("var x = 1 + 2; function f(n) { return n * 2; }",
                      { ecmaVersion: 2020 });
assert(ast.type === "Program",           "root is Program");
assert(ast.body.length === 2,            "two top-level statements");
assert(ast.body[0].type === "VariableDeclaration", "stmt 0 is var decl");
assert(ast.body[1].type === "FunctionDeclaration", "stmt 1 is fn decl");
console.log("ok: simple parse — two statements, right node types");

// 2. Error surface: parse a broken program, catch the thrown error.
var caught = null;
try {
    acorn.parse("function ( {", { ecmaVersion: 2020 });
} catch (e) {
    caught = e;
}
assert(caught !== null,                    "broken program throws");
assert(typeof caught.message === "string", "error has string message");
assert(typeof caught.pos === "number",     "error has numeric pos");
console.log("ok: parse error thrown correctly:",
            caught.name + ":", caught.message.slice(0, 40) + "...");

// 3. Bootstrap: can acorn parse itself?
var selfPath   = path.join(process.cwd(), "test/vendor/acorn.js");
var selfSource = fs.readFileSync(selfPath, "utf8");
console.log("parsing acorn.js (" + selfSource.length + " bytes)...");
var start = Date.now();
var selfAst = acorn.parse(selfSource, { ecmaVersion: 2020, sourceType: "script" });
var elapsed = Date.now() - start;
assert(selfAst.type === "Program", "self-parse produced a Program");
console.log("ok: acorn parsed its own source in " + elapsed + " ms");
console.log("    top-level statements: " + selfAst.body.length);

console.log("\nacorn smoke: all assertions passed");
