// Smoke: the top-level-await heuristic must skip CJS modules. Pre-v0.99
// `_looksLikeTopLevelAwait` brace-counted to decide whether to wrap the
// source in an async IIFE. Template literals with `${}` substitutions
// (`...${foo.bar}...`) confused the counter — the {/} from the
// substitution land outside string-literal stripping, and the depth
// counter goes negative, causing `await` inside async functions to
// look like top-level. axios.cjs trips this exactly that way.
//
// Fix: short-circuit the heuristic to false when the source uses
// `module.exports` or `exports.X = ` (CJS smell tests). Node forbids
// top-level await in CJS anyway, so this is safe.

var fs   = require('fs');
var path = require('path');
var os   = require('os');
var cp   = require('child_process');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-tla-cjs-" + rand);
fs.mkdirSync(root, { recursive: true });

// A CJS module with: a template literal whose substitution uses dot-
// access (confuses brace counter), an `async function*` containing
// `yield await ...`, and `module.exports = ...` at the bottom. Pre-fix
// this required the TLA wrap and `module.exports` would never reach
// the caller (and re-eval blew up on something downstream).
var modSrc = [
    "// fake CJS module exercising the TLA brace-count false-positive.",
    "var x = `value=${({a:1}).a}`;",
    "async function* gen() {",
    "    yield await Promise.resolve(42);",
    "}",
    "async function consume() {",
    "    for await (var v of gen()) return v;",
    "}",
    "module.exports = { consume: consume, label: x };"
].join('\n');
var modPath = path.join(root, "cjs_mod.js");
fs.writeFileSync(modPath, modSrc);

var entryPath = path.join(root, "entry.js");
fs.writeFileSync(entryPath,
    "var m = require('./cjs_mod.js');\n" +
    "if (typeof m !== 'object' || typeof m.consume !== 'function') {\n" +
    "    console.error('module.exports did not arrive synchronously; got:', m);\n" +
    "    process.exit(2);\n" +
    "}\n" +
    "if (m.label !== 'value=1') {\n" +
    "    console.error('label string wrong:', m.label);\n" +
    "    process.exit(3);\n" +
    "}\n" +
    "console.log('cjs_mod.exports arrived sync, label=' + m.label);\n"
);

var nodeBin = path.resolve(process.cwd(), process.argv[0]);
var result = cp.spawnSync(nodeBin, [entryPath], { encoding: 'utf8' });
assert(result.status === 0,
    "child exited " + result.status + "; stderr: " + result.stderr +
    " stdout: " + result.stdout);
assert(result.stdout.indexOf('label=value=1') >= 0,
    "expected label in stdout; got: " + JSON.stringify(result.stdout));

// Cleanup.
function rmrf(p) {
    if (!fs.existsSync(p)) return;
    var st = fs.lstatSync(p);
    if (st.isDirectory()) {
        var ents = fs.readdirSync(p);
        for (var i = 0; i < ents.length; i++) rmrf(path.join(p, ents[i]));
        fs.rmdirSync(p);
    } else {
        fs.unlinkSync(p);
    }
}
rmrf(root);

console.log("babel_tla_cjs_guard_smoke: CJS module with async generator + template literal loaded synchronously");
