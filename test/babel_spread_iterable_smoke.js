// Smoke: parse-failure Babel fallback must lower `[...iterable]` for
// non-Array iterables (Set, Map) correctly. With `loose: true` on
// preset-env, Babel emits `[].concat(x)` for `[...x]` — which works
// for arrays but produces `[Set]` (a one-element array wrapping the
// Set) for non-Array iterables. That silently broke any source like
// `[...new Set(arr)]` (e.g. test/vendor/array-uniq.js). v0.99 drops
// loose mode so the spread transform uses an iterator-protocol
// helper instead.

var fs   = require('fs');
var path = require('path');
var os   = require('os');
var cp   = require('child_process');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-spread-iter-" + rand);
fs.mkdirSync(root, { recursive: true });

// ESM source forcing the parse-fail + Babel-lower path. Spreads a Set
// (and a Map iterator), which is the regression case.
var modSrc = [
    "export default function uniq(arr) {",
    "    return [...new Set(arr)];",
    "}",
    "export function mapKeys(m) {",
    "    return [...m.keys()];",
    "}"
].join('\n');
fs.writeFileSync(path.join(root, "mod.js"), modSrc);

var entrySrc = [
    "var m = require('./mod.js');",
    "var uniq = m.default;",
    "var out = uniq([1, 2, 2, 3, 3, 3]);",
    "if (JSON.stringify(out) !== '[1,2,3]') {",
    "    console.error('FAIL: uniq dedupe got', JSON.stringify(out));",
    "    process.exit(2);",
    "}",
    "var keys = m.mapKeys(new Map([['a', 1], ['b', 2]]));",
    "if (JSON.stringify(keys) !== '[\"a\",\"b\"]') {",
    "    console.error('FAIL: map keys spread got', JSON.stringify(keys));",
    "    process.exit(3);",
    "}",
    "console.log('iter-spread OK: uniq=' + JSON.stringify(out) + ' keys=' + JSON.stringify(keys));"
].join('\n');
fs.writeFileSync(path.join(root, "entry.js"), entrySrc);

var nodeBin = path.resolve(process.cwd(), process.argv[0]);
var result = cp.spawnSync(nodeBin, ['entry.js'],
                          { cwd: root, encoding: 'utf8' });
assert(result.status === 0,
    "child exited " + result.status + "; stderr: " + result.stderr +
    " stdout: " + result.stdout);
assert(result.stdout.indexOf('iter-spread OK') >= 0,
    "expected success marker in stdout; got: " + JSON.stringify(result.stdout));

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

console.log("babel_spread_iterable_smoke: [...new Set(arr)] and [...m.keys()] both lowered correctly");
