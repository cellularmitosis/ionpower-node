// fs.readlink / fs.readlinkSync (Node 10 parity, pass 1).
//
// Surfaced by npm 6.14.18's read-package-tree, which feeds fs.readlink
// through util.promisify before walking node_modules. Pre-v0.87 we
// lacked any readlink at all.

var fs = require("fs");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof fs.readlinkSync === "function", "fs.readlinkSync is function");
assert(typeof fs.readlink     === "function", "fs.readlink is function");

var dir = process.cwd() + "/.fs-readlink-smoke-" + process.pid;
fs.mkdirSync(dir);
var target = dir + "/real.txt";
var link   = dir + "/link.txt";
fs.writeFileSync(target, "hello readlink");

// Sync path: create a symlink, read it back.
fs.symlinkSync(target, link);
var got = fs.readlinkSync(link);
assert(got === target,
       "readlinkSync target mismatch; got " + JSON.stringify(got));
console.log("ok: fs.readlinkSync(' .. ') ->", got);

// readlink on a regular file should throw EINVAL.
var threw = false;
try { fs.readlinkSync(target); }
catch (e) {
    threw = true;
    assert(e && e.code === "EINVAL",
           "readlinkSync(non-link) threw EINVAL; got code=" + (e && e.code));
}
assert(threw, "readlinkSync(non-link) should throw");
console.log("ok: readlinkSync on regular file throws EINVAL");

// Async path.
fs.readlink(link, function (err, got2) {
    assert(!err, "fs.readlink err: " + (err && err.message));
    assert(got2 === target,
           "readlink target mismatch; got " + JSON.stringify(got2));
    console.log("ok: fs.readlink(cb) ->", got2);

    // Cleanup.
    fs.unlinkSync(link);
    fs.unlinkSync(target);
    fs.rmdirSync(dir);
    console.log("\nfs_readlink smoke: all assertions passed");
});
