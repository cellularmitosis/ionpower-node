// fs.{truncate,symlink,chown,utimes,fchmod} (Node 10 parity, pass 1).
//
// Surfaced by the npm 6 bring-up: pacote/extract.js promisified
// fs.truncate; bluebird threw because fs.truncate was undefined.
// The whole batch lands together because each is one syscall.

var fs = require("fs");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof fs.truncateSync === "function", "fs.truncateSync");
assert(typeof fs.truncate     === "function", "fs.truncate");
assert(typeof fs.symlinkSync  === "function", "fs.symlinkSync");
assert(typeof fs.symlink      === "function", "fs.symlink");
assert(typeof fs.chownSync    === "function", "fs.chownSync");
assert(typeof fs.chown        === "function", "fs.chown");
assert(typeof fs.utimesSync   === "function", "fs.utimesSync");
assert(typeof fs.utimes       === "function", "fs.utimes");
assert(typeof fs.fchmodSync   === "function", "fs.fchmodSync");
assert(typeof fs.fchmod       === "function", "fs.fchmod");

var dir = process.cwd() + "/.fs-extras2-smoke-" + process.pid;
fs.mkdirSync(dir);

// truncate: shrink and grow.
var f = dir + "/t.txt";
fs.writeFileSync(f, "0123456789");          // 10 bytes
fs.truncateSync(f, 5);
assert(fs.readFileSync(f, "utf8") === "01234",
       "truncate shrink to 5; got " + JSON.stringify(fs.readFileSync(f, "utf8")));
fs.truncateSync(f, 0);
assert(fs.statSync(f).size === 0, "truncate to 0");
console.log("ok: fs.truncateSync");

// symlink + readlink (verifies symlinkSync more thoroughly than the
// readlink smoke — that one focuses on the read side).
var lnk = dir + "/lnk";
fs.writeFileSync(f, "linktest");
fs.symlinkSync(f, lnk);
assert(fs.readlinkSync(lnk) === f, "symlink target");
console.log("ok: fs.symlinkSync");

// chown: we can't reliably check end-state without process.getuid (not
// yet exposed) or stat.uid (also not yet on our Stats shape). The
// useful-without-blowing-up assertion is that chown(file, -1, -1) is
// the documented Unix no-op (-1 means "leave unchanged"). On darwin
// PPC this is permitted to non-root for self-owned files.
try {
    fs.chownSync(f, -1, -1);
    console.log("ok: fs.chownSync(file, -1, -1) no-op");
} catch (e) {
    if (e && e.code === "EPERM") {
        console.log("note: chown EPERM (sandboxed env?) — skipping assert");
    } else {
        throw e;
    }
}

// utimes: set atime + mtime to a known value, read back via stat.
var newTs = Math.floor(Date.now() / 1000) - 10000;  // 10000s ago
fs.utimesSync(f, newTs, newTs);
var st1 = fs.statSync(f);
// stat.mtime is a Date (Node-compatible); use mtimeMs for the numeric
// milliseconds form. Allow ±2s slack.
var mtimeSec = Math.floor(st1.mtimeMs / 1000);
assert(Math.abs(mtimeSec - newTs) <= 2,
       "utimes mtime mismatch; want " + newTs + " got " + mtimeSec);
console.log("ok: fs.utimesSync (mtime ~", mtimeSec, ")");

// Async truncate + readlink-style cb path for readability.
fs.truncate(f, 4, function (err) {
    assert(!err, "fs.truncate cb err: " + (err && err.message));
    assert(fs.statSync(f).size === 4, "async truncate to 4");
    console.log("ok: fs.truncate(cb)");

    // fchmod via fs.openSync — but we don't have openSync in the public
    // API. Skip fchmod's runtime test; the function-existence check
    // above is the meaningful smoke for now (Node 10 parity will need a
    // real fs.openSync later, see followups).
    //
    // Cleanup.
    fs.unlinkSync(lnk);
    fs.unlinkSync(f);
    fs.rmdirSync(dir);
    console.log("\nfs_extras2 smoke: all assertions passed");
});
