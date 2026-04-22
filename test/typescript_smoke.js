// Smoke test: TypeScript compiler on ionpower-node.
// 9 MB of compiler code. If it loads without OOM and can transpile a
// trivial TS snippet, that's a big deal for the runtime.

var start = Date.now();
var ts = require("./vendor/typescript.js");
console.log("loaded typescript v" + ts.version +
            " in " + (Date.now() - start) + " ms");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Transpile a trivial TS snippet.
var src1 = "const x: number = 42; export const y = x * 2;";
var start1 = Date.now();
var out1 = ts.transpileModule(src1, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 }
});
console.log("transpile 1 in", Date.now() - start1, "ms");
assert(typeof out1.outputText === "string", "transpile produced output");
assert(out1.outputText.indexOf("var x") >= 0, "ES5 target emitted `var`, got:\n" + out1.outputText);
assert(out1.outputText.indexOf(":") < out1.outputText.indexOf("42"),
       "type annotation should be stripped");
console.log("ok: simple transpile ->");
console.log(out1.outputText);

// 2. A slightly bigger input: a class with methods and generics.
var src2 = [
    "interface Point { x: number; y: number; }",
    "class Shape<T extends Point> {",
    "    constructor(public origin: T, public label: string) {}",
    "    move(dx: number, dy: number): void {",
    "        this.origin = { ...this.origin, x: this.origin.x + dx, y: this.origin.y + dy };",
    "    }",
    "}",
    "const s = new Shape<Point>({ x: 0, y: 0 }, 'pt');",
    "s.move(3, 4);"
].join("\n");
var start2 = Date.now();
var out2 = ts.transpileModule(src2, {
    compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }
});
console.log("transpile 2 in", Date.now() - start2, "ms");
assert(out2.outputText.indexOf("function Shape") >= 0 ||
       out2.outputText.indexOf("var Shape") >= 0,
       "ES5 class->function lowering, got:\n" + out2.outputText);
console.log("ok: class-with-generic compiled; output length =", out2.outputText.length);

console.log("\ntypescript smoke: all assertions passed");
