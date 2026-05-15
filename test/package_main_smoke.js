// Smoke: package.json "main" resolution must find the top-level "main"
// key, not the first occurrence in the file. handlebars@4.7.8 ships:
//
//   "jspm": {
//     "main": "handlebars",        <-- nested, NOT what require() wants
//     ...
//   },
//   ...
//   "main": "lib/index.js",        <-- the real one
//
// A naive strstr-for-"main" finds the jspm one first, resolves to
// node_modules/handlebars/handlebars (which doesn't exist), and
// require('handlebars') fails. The resolver must track brace depth.

var fs   = require('fs');
var path = require('path');
var os   = require('os');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// Build a temp tree:
//   /tmp/ion-pkgmain-NNNN/node_modules/widget/package.json
//   /tmp/ion-pkgmain-NNNN/node_modules/widget/lib/index.js     <-- the real entry
//   /tmp/ion-pkgmain-NNNN/test-entry.js                        <-- require('widget') here

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-pkgmain-" + rand);
var pkgDir = path.join(root, "node_modules", "widget");
var libDir = path.join(pkgDir, "lib");
fs.mkdirSync(libDir, { recursive: true });

// package.json with nested "main" (shadowed by jspm-style block) and
// a real top-level "main" pointing at lib/index.js.
var pkgJson = {
    name: "widget",
    version: "1.0.0",
    jspm: {
        main: "wrong-path-should-be-ignored",
        directories: { lib: "dist/amd" }
    },
    main: "lib/index.js"
};
fs.writeFileSync(path.join(pkgDir, "package.json"),
                 JSON.stringify(pkgJson, null, 2));

// Real entry.
fs.writeFileSync(path.join(libDir, "index.js"),
                 "module.exports = function () { return 'real entry'; };\n");

// Smoke: require('widget') from a script in the temp root.
var entry = path.join(root, "test-entry.js");
fs.writeFileSync(entry,
    "var w = require('widget');\n" +
    "console.log(w());\n");

// Run via child_process — same binary, so the test exercises the
// production resolver path against our temp tree. argv[0] is often a
// relative path (e.g. './node'); resolve it against the current cwd
// before changing into the temp dir.
var child_process = require('child_process');
var nodeBin = path.resolve(process.cwd(), process.argv[0]);
var result = child_process.spawnSync(nodeBin, [entry],
                                     { cwd: root, encoding: 'utf8' });
if (result.status !== 0) {
    console.error("subprocess exited", result.status);
    console.error("stdout:", result.stdout);
    console.error("stderr:", result.stderr);
    process.exit(1);
}
assert(result.stdout.trim() === 'real entry',
    "require resolved wrong entry; stdout: " + JSON.stringify(result.stdout));

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

console.log("package_main_smoke: resolver picked top-level main past nested jspm.main");
