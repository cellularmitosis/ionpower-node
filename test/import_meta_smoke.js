// import.meta.* + dynamic import() — both rewritten by the Babel-side
// pre-processor (regex substitutions) so that real Node code that
// uses ESM-only constructs runs on our CJS-only runtime.
//
// We test via spawned child scripts because our own *_smoke.js
// suite is loaded directly (no parse failure path).

var fs = require("fs");
var path = require("path");
var os = require("os");
var child_process = require("child_process");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var nodeBin = process.argv[0];

function runChild(name, src) {
    var p = path.join(os.tmpdir(), "ion-" + name + "-" + process.pid + ".js");
    fs.writeFileSync(p, src);
    var r = child_process.spawnSync(nodeBin, [p], { encoding: "utf8" });
    try {
        if (r.status !== 0) {
            console.error("script " + name + " exit " + r.status + "\nstderr: " + r.stderr +
                          "\nstdout: " + r.stdout);
            process.exit(1);
        }
        return r.stdout;
    } finally { try { fs.unlinkSync(p); } catch (e) {} }
}

// ---- import.meta.url ----
var out = runChild("ima-url",
    'console.log("URL=" + import.meta.url);\n');
assert(/^URL=file:\/\/.+ima-url-\d+\.js$/m.test(out),
       "import.meta.url is file:// + __filename: " + JSON.stringify(out));
console.log("ok: import.meta.url");

// ---- import.meta.filename + .dirname ----
var out2 = runChild("ima-fd",
    'console.log("FN=" + import.meta.filename);\n' +
    'console.log("DN=" + import.meta.dirname);\n');
assert(/FN=.+ima-fd-\d+\.js/.test(out2), "import.meta.filename: " + out2);
assert(/DN=.+/.test(out2), "import.meta.dirname: " + out2);
console.log("ok: import.meta.filename / .dirname");

// ---- Dynamic import() of a built-in ----
var out3 = runChild("dyn-fs",
    'import("fs").then(function (m) { console.log("HAS_RFS=" + (typeof m.default.readFileSync === "function")); });\n');
assert(/HAS_RFS=true/.test(out3), "dynamic import('fs') resolves: " + out3);
console.log("ok: dynamic import('fs')");

// ---- Dynamic import() of a relative file ----
var helper = path.join(os.tmpdir(), "ion-dyn-helper-" + process.pid + ".js");
fs.writeFileSync(helper, 'module.exports = { greet: function (n) { return "hi " + n; } };\n');
try {
    var out4 = runChild("dyn-rel",
        'import("' + helper + '").then(function (m) { console.log("OUT=" + m.default.greet("world")); });\n');
    assert(/OUT=hi world/.test(out4), "dynamic import of absolute path: " + out4);
    console.log("ok: dynamic import('/abs/path')");
} finally { try { fs.unlinkSync(helper); } catch (e) {} }

// ---- await import() (combines TLA + dynamic import) ----
var out5 = runChild("dyn-await",
    'var m = await import("fs");\n' +
    'console.log("HAS_EXISTS=" + (typeof m.default.existsSync === "function"));\n');
assert(/HAS_EXISTS=true/.test(out5), "await import('fs') works: " + out5);
console.log("ok: await import('fs')");

console.log("\nimport_meta smoke: all assertions passed");
