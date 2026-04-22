// fs.appendFileSync / copyFileSync / chmodSync smoke.

var fs = require("fs");
var path = require("path");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var tmp = process.cwd() + "/.fs-extras-smoke-" + process.pid;
try { fs.mkdirSync(tmp); } catch (_) {}

// appendFileSync: creates, then appends.
var src = tmp + "/a.txt";
fs.appendFileSync(src, "hello");
assert(fs.readFileSync(src, "utf8") === "hello", "append created+wrote");
fs.appendFileSync(src, ", world");
assert(fs.readFileSync(src, "utf8") === "hello, world", "append grew file");
console.log("ok: appendFileSync");

// copyFileSync: copies bytes; dst gets overwritten.
var dst = tmp + "/b.txt";
fs.copyFileSync(src, dst);
assert(fs.readFileSync(dst, "utf8") === "hello, world", "copy bytes");
fs.writeFileSync(dst, "prev");
fs.copyFileSync(src, dst);
assert(fs.readFileSync(dst, "utf8") === "hello, world", "copy overwrites");
console.log("ok: copyFileSync");

// chmodSync: set a distinctive mode and read it back via statSync.
fs.chmodSync(dst, parseInt("0600", 8));
var st = fs.statSync(dst);
assert((st.mode & 0x1FF) === parseInt("600", 8),
       "chmod 0600 expected; got " + (st.mode & 0x1FF).toString(8));
fs.chmodSync(dst, parseInt("0644", 8));
st = fs.statSync(dst);
assert((st.mode & 0x1FF) === parseInt("644", 8),
       "chmod 0644 expected; got " + (st.mode & 0x1FF).toString(8));
console.log("ok: chmodSync");

// Cleanup.
fs.unlinkSync(src);
fs.unlinkSync(dst);
fs.rmdirSync(tmp);

console.log("\nfs_extras smoke: all assertions passed");
