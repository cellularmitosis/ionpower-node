// fs_fchown_smoke.js — fs.fchown / fchownSync are needed by tar's
// unpack (which restores ownership on freshly extracted files).
// Without them, npm install crashes mid-extract with
// `fs.fchown is not a function`.
//
// Tiger restriction: on Mac OS X 10.4, even fchown to your own
// uid/gid fails with EPERM for non-root. Our native impl
// short-circuits as a no-op when the target uid/gid already match
// the file's current owner (see fs.cpp's FsFchownSync); the smoke
// here exercises that exact path.

var fs = require('fs');
var assert = require('assert');

console.log('--- fs.fchown smoke ---');

var p = '/tmp/ionpower-node-fchown-test-' + process.pid;
fs.writeFileSync(p, 'hello fchown');
var fd = fs.openSync(p, 'r+');

try {
    // 1. Functions exist.
    assert.strictEqual(typeof fs.fchownSync, 'function',
                       'fs.fchownSync must be a function');
    assert.strictEqual(typeof fs.fchown, 'function',
                       'fs.fchown must be a function');

    // 2. Calling fchownSync with the file's current uid/gid must
    //    succeed via our no-op short-circuit (NOT via the syscall,
    //    which Tiger denies for non-root). We get the current
    //    owner from statSync.
    var st = fs.statSync(p);
    var ownerUid = st.uid;
    var ownerGid = st.gid;
    fs.fchownSync(fd, ownerUid, ownerGid);
    console.log('  ok: fchownSync(fd, owner_uid, owner_gid) succeeded via no-op');

    // 3. fs.chownSync with same owner also short-circuits.
    fs.chownSync(p, ownerUid, ownerGid);
    console.log('  ok: chownSync(path, owner_uid, owner_gid) succeeded via no-op');

    // 4. fs.fchown async with same owner succeeds.
    fs.fchown(fd, ownerUid, ownerGid, function (err) {
        assert.ifError(err);
        console.log('  ok: fchown async no-op completed');

        if (fs.promises && typeof fs.promises.fchown === 'function') {
            fs.promises.fchown(fd, ownerUid, ownerGid).then(function () {
                console.log('  ok: fs.promises.fchown no-op resolved');
                cleanup();
            }, function (e) {
                console.error('  FAIL: fs.promises.fchown rejected unexpectedly: ' +
                              (e && e.message));
                cleanup();
                process.exit(1);
            });
        } else {
            console.log('  (fs.promises.fchown not present — acceptable)');
            cleanup();
        }
    });
} catch (e) {
    try { fs.closeSync(fd); fs.unlinkSync(p); } catch (e2) {}
    throw e;
}

function cleanup () {
    fs.closeSync(fd);
    fs.unlinkSync(p);
    console.log('--- fs.fchown smoke OK ---');
}
