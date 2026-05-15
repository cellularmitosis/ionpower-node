// Smoke: package.json "main" resolution must work when the "main"
// field sits past the first 4 KB of the file. Pre-v0.99 the resolver
// used a fixed 4 KB stack buffer to read package.json; axios@1.16.1
// (7.4 KB) put "main" past byte 4095 and we fell through to
// index.js — landing on the ESM source tree instead of the proper
// CJS bundle. Pad the synthetic pkg.json with a large dummy field so
// "main" lands past the old read window.

var fs   = require('fs');
var path = require('path');
var os   = require('os');
var cp   = require('child_process');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-pkgmain-large-" + rand);
var pkgDir = path.join(root, "node_modules", "bigpkg");
var distDir = path.join(pkgDir, "dist", "node");
fs.mkdirSync(distDir, { recursive: true });

// Build a package.json that's >5 KB with "main" near the end.
// Use a 'description' field stuffed with ASCII so "main" comes
// past byte 4095.
var bigDescription = "";
while (bigDescription.length < 5000) {
    bigDescription += "padding text not relevant to the resolver; ";
}
var pkgJson = {
    name: "bigpkg",
    version: "1.0.0",
    description: bigDescription,   // lands first, pushes "main" past 4 KB
    main: "./dist/node/entry.cjs"
};
fs.writeFileSync(path.join(pkgDir, "package.json"),
                 JSON.stringify(pkgJson, null, 2));

// Real entry at the path "main" points to.
fs.writeFileSync(path.join(distDir, "entry.cjs"),
                 "module.exports = function () { return 'cjs entry'; };\n");

// Decoy index.js in the package root — if the resolver mis-falls-through
// to <pkg>/index.js, we'll see this string and fail.
fs.writeFileSync(path.join(pkgDir, "index.js"),
                 "module.exports = function () { return 'wrong-decoy'; };\n");

var entry = path.join(root, "test-entry.js");
fs.writeFileSync(entry,
    "var w = require('bigpkg');\n" +
    "console.log(w());\n");

var nodeBin = path.resolve(process.cwd(), process.argv[0]);
var result = cp.spawnSync(nodeBin, [entry],
                          { cwd: root, encoding: 'utf8' });
if (result.status !== 0) {
    console.error("subprocess exited", result.status);
    console.error("stdout:", result.stdout);
    console.error("stderr:", result.stderr);
    process.exit(1);
}
assert(result.stdout.trim() === 'cjs entry',
    "resolver fell through to decoy index.js; expected 'cjs entry', got: " +
    JSON.stringify(result.stdout));

// Sanity-check the synthetic package.json really is past 4 KB and the
// "main" position is past byte 4095.
var raw = fs.readFileSync(path.join(pkgDir, "package.json"), 'utf8');
var mainPos = raw.indexOf('"main"');
assert(raw.length > 5000, "synthetic pkg.json should be >5KB; got " + raw.length);
assert(mainPos > 4095,
    "synthetic 'main' should sit past byte 4095; got " + mainPos);

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

console.log("package_main_large_smoke: resolver found 'main' past 4KB window (pkg.json was " + raw.length + "B, main at byte " + mainPos + ")");
