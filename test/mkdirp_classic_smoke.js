// mkdirp-classic: recursive mkdir. Uses fs.mkdirSync + process.umask().

var mkdirp = require("./vendor/mkdirp-classic.js");
var fs = require("fs");
var path = require("path");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Sync form, deep nested path.
var base = "/tmp/ionpower-mkdirp-" + Date.now();
var nested = path.join(base, "a", "b", "c", "d");
var made = mkdirp.sync(nested);
assert(fs.existsSync(nested), "nested dir created: " + nested);
console.log("ok: mkdirp.sync created", nested, "(made=" + made + ")");

// Idempotent: second call is a no-op.
mkdirp.sync(nested);
assert(fs.existsSync(nested), "idempotent re-mkdirp");
console.log("ok: mkdirp.sync idempotent");

// Stat reports directory.
var st = fs.statSync(nested);
assert(st.isDirectory(), "stat reports directory");
console.log("ok: isDirectory() on mkdirp'd path");

// Cleanup: rmdir leaves from deepest up.
try {
    fs.rmdirSync(nested);
    fs.rmdirSync(path.join(base, "a", "b", "c"));
    fs.rmdirSync(path.join(base, "a", "b"));
    fs.rmdirSync(path.join(base, "a"));
    fs.rmdirSync(base);
} catch (e) { /* ignore */ }

console.log("\nmkdirp-classic smoke: all assertions passed");
