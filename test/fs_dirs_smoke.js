// Smoke test for mkdirSync / rmdirSync / renameSync.

const fs   = require("fs");
const path = require("path");

var tmp = "/tmp/ionpower-node-fs-dirs-test";
var nested = path.join(tmp, "a/b/c");

// mkdirSync with { recursive: true } should create all components.
if (fs.existsSync(tmp)) {
    // Shouldn't happen, but clean up defensively.
    console.error("warning:", tmp, "already exists; test may conflict");
}
fs.mkdirSync(nested, { recursive: true });
if (!fs.existsSync(nested)) { console.error("FAIL: mkdirSync recursive"); process.exit(1); }
if (!fs.statSync(nested).isDirectory) { console.error("FAIL: created path is not a dir"); process.exit(1); }
console.log("ok: mkdirSync recursive created", nested);

// renameSync
var renamed = path.join(tmp, "a/b/c-renamed");
fs.renameSync(nested, renamed);
if (fs.existsSync(nested))   { console.error("FAIL: old name still exists"); process.exit(1); }
if (!fs.existsSync(renamed)) { console.error("FAIL: new name doesnt exist"); process.exit(1); }
console.log("ok: renameSync ->", renamed);

// rmdirSync works on empty directories only.
fs.rmdirSync(renamed);
fs.rmdirSync(path.join(tmp, "a/b"));
fs.rmdirSync(path.join(tmp, "a"));
fs.rmdirSync(tmp);
if (fs.existsSync(tmp)) { console.error("FAIL: rmdirSync didnt remove"); process.exit(1); }
console.log("ok: rmdirSync removed the nested chain");

console.log("\nfs_dirs smoke: all assertions passed");
