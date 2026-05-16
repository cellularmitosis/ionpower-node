// Smoke: require('<pkg>/<subpath>') must resolve to <pkg>/<subpath>.json
// when only the .json file exists. Pre-v1.0 the resolver tried
// .js / .cjs / index.js / index.cjs / index.json but did NOT try
// <base>.json — so packages like spdx-license-ids that ship
// deprecated.json at the root and are imported as
// `require('spdx-license-ids/deprecated')` failed to resolve.

var fs   = require('fs');
var path = require('path');
var os   = require('os');
var cp   = require('child_process');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-subpath-json-" + rand);
var pkgDir = path.join(root, "node_modules", "data-pkg");
fs.mkdirSync(pkgDir, { recursive: true });

fs.writeFileSync(path.join(pkgDir, "package.json"),
                 JSON.stringify({ name: "data-pkg", version: "1.0.0" }));
fs.writeFileSync(path.join(pkgDir, "index.json"),
                 JSON.stringify({ kind: "default", count: 1 }));
// A subpath JSON file with no .js sibling — exactly the spdx case.
fs.writeFileSync(path.join(pkgDir, "deprecated.json"),
                 JSON.stringify({ kind: "deprecated", count: 99 }));

var entry = path.join(root, "test-entry.js");
fs.writeFileSync(entry,
    "var d = require('data-pkg/deprecated');\n" +
    "if (!d || d.kind !== 'deprecated' || d.count !== 99) {\n" +
    "    console.error('FAIL: got', JSON.stringify(d));\n" +
    "    process.exit(1);\n" +
    "}\n" +
    "console.log('ok');\n");

var nodeBin = path.resolve(process.cwd(), process.argv[0]);
var result = cp.spawnSync(nodeBin, [entry],
                          { cwd: root, encoding: 'utf8' });

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

if (result.status !== 0) {
    console.error("subprocess exited", result.status);
    console.error("stdout:", result.stdout);
    console.error("stderr:", result.stderr);
    process.exit(1);
}
assert(result.stdout.trim() === 'ok',
    "resolver did not find <pkg>/<subpath>.json; stdout: " +
    JSON.stringify(result.stdout));

console.log("require_subpath_json_smoke: <pkg>/<subpath> resolves to .json");
