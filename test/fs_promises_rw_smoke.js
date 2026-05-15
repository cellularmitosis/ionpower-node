// Smoke: fs.promises.read / fs.promises.write return shape.
// Real Node resolves with { bytesRead, buffer } and { bytesWritten,
// buffer } objects, not just the integer count. User code commonly
// destructures: `const { bytesRead, buffer } = await fh.read(...);`.

var fs = require('fs');
var path = require('path');
var os = require('os');

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var tmp = path.join(os.tmpdir(), 'ion-fs-rw-' + Math.floor(Math.random() * 1e9));
fs.writeFileSync(tmp, 'abcdefghij');  // 10 bytes

// fs.promises.read
fs.promises.open(tmp, 'r').then(function (fd) {
    var buf = Buffer.alloc(5);
    return fs.promises.read(fd, buf, 0, 5, 0).then(function (result) {
        assert(result && typeof result === 'object',
               "promises.read should resolve to object; got " + typeof result);
        assert(result.bytesRead === 5,
               "bytesRead should be 5; got " + result.bytesRead);
        assert(result.buffer === buf,
               "buffer should be the same buffer instance");
        assert(buf.toString('utf8', 0, 5) === 'abcde',
               "buffer contents should be 'abcde'; got " + buf.toString('utf8', 0, 5));
        return fs.promises.close(fd);
    });
}).then(function () {
    // fs.promises.write
    return fs.promises.open(tmp, 'w').then(function (fd) {
        var data = Buffer.from('XYZ');
        return fs.promises.write(fd, data, 0, 3, 0).then(function (result) {
            assert(result && typeof result === 'object',
                   "promises.write should resolve to object; got " + typeof result);
            assert(result.bytesWritten === 3,
                   "bytesWritten should be 3; got " + result.bytesWritten);
            assert(result.buffer === data,
                   "buffer should be the same buffer instance");
            return fs.promises.close(fd);
        });
    });
}).then(function () {
    var v = fs.readFileSync(tmp, 'utf8');
    assert(v === 'XYZ',
           "file should contain 'XYZ' after write; got " + JSON.stringify(v));
    fs.unlinkSync(tmp);
    console.log("fs_promises_rw_smoke: { bytesRead, buffer } and { bytesWritten, buffer } shapes ok");
}).catch(function (e) {
    console.error("FAIL:", e && e.stack || e);
    process.exit(1);
});
