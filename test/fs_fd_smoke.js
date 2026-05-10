// fs.{open,close,read,write}{Sync,async} (Node 10 parity, pass 2 wave 2).
//
// Surfaced by the npm 6.14.18 install pipeline: bin-links/index.js does
// `BB.promisify(fs.open)`, `BB.promisify(fs.close)`,
// `BB.promisify(fs.read, {multiArgs: true})`, etc. at module-load time;
// undefined function -> bluebird throws -> install plateaus.

var fs = require("fs");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof fs.openSync  === "function", "fs.openSync is function");
assert(typeof fs.closeSync === "function", "fs.closeSync is function");
assert(typeof fs.readSync  === "function", "fs.readSync is function");
assert(typeof fs.writeSync === "function", "fs.writeSync is function");
assert(typeof fs.open      === "function", "fs.open is function");
assert(typeof fs.close     === "function", "fs.close is function");
assert(typeof fs.read      === "function", "fs.read is function");
assert(typeof fs.write     === "function", "fs.write is function");

var tmp = "/tmp/ionpower-fs-fd-smoke-" + process.pid + ".bin";

// ----- Sync round-trip -----
var msg = "hello fd world\n";
var fd = fs.openSync(tmp, "w");
assert(typeof fd === "number" && fd >= 0, "openSync('w') returns numeric fd");
var n = fs.writeSync(fd, msg);
assert(n === msg.length,
       "writeSync(string) returns byte count: " + n + " vs " + msg.length);
fs.closeSync(fd);
console.log("ok: open/write/close sync (string)");

// Read it back as Buffer.
var fd2 = fs.openSync(tmp, "r");
var buf = new Uint8Array(64);
var nr = fs.readSync(fd2, buf, 0, buf.length, 0);
assert(nr === msg.length, "readSync returns bytes read: " + nr);
fs.closeSync(fd2);
var read = "";
for (var i = 0; i < nr; i++) read += String.fromCharCode(buf[i]);
assert(read === msg, "round-tripped data matches: " + JSON.stringify(read));
console.log("ok: open/read/close sync (buffer)");

// Write Buffer form.
var fd3 = fs.openSync(tmp, "w");
var u8 = new Uint8Array(5);
u8[0] = 65; u8[1] = 66; u8[2] = 67; u8[3] = 68; u8[4] = 69;
var n2 = fs.writeSync(fd3, u8, 0, u8.length);
assert(n2 === 5, "writeSync(buffer, 0, 5) returns 5");
fs.closeSync(fd3);
var verify = fs.readFileSync(tmp, "utf8");
assert(verify === "ABCDE", "buffer write produced 'ABCDE': " + JSON.stringify(verify));
console.log("ok: writeSync(buffer) form");

// pread: read from a specific position.
var fd4 = fs.openSync(tmp, "r");
var pbuf = new Uint8Array(2);
var pn = fs.readSync(fd4, pbuf, 0, 2, 2);  // skip 'AB', read 'CD'
assert(pn === 2, "pread length");
assert(pbuf[0] === 67 && pbuf[1] === 68, "pread positioned correctly");
fs.closeSync(fd4);
console.log("ok: readSync with explicit position");

// Bad fd → EBADF.
var threw = false;
try { fs.closeSync(999999); }
catch (e) { threw = true; assert(e.code === "EBADF", "closeSync bad fd code: " + e.code); }
assert(threw, "closeSync(bad fd) throws");
console.log("ok: closeSync(bad fd) -> EBADF");

// Numeric flags also accepted.
var O_RDONLY = require("constants").O_RDONLY;
var fd5 = fs.openSync(tmp, O_RDONLY);
assert(fd5 >= 0, "openSync with numeric flags");
fs.closeSync(fd5);
console.log("ok: openSync with numeric flags");

// ----- Async round-trip -----
fs.open(tmp, "r", function (err, afd) {
    assert(!err, "fs.open async no error: " + (err && err.message));
    var ab = new Uint8Array(5);
    fs.read(afd, ab, 0, 5, 0, function (rerr, bytes, returnedBuf) {
        assert(!rerr, "fs.read async no error: " + (rerr && rerr.message));
        assert(bytes === 5, "async read bytes: " + bytes);
        assert(returnedBuf === ab, "async read returns the same buffer");
        assert(ab[0] === 65 && ab[4] === 69, "async read filled buffer");
        fs.close(afd, function (cerr) {
            assert(!cerr, "fs.close async no error");

            // Async write a different file.
            var out = tmp + ".out";
            fs.open(out, "w", function (oerr, wfd) {
                assert(!oerr, "fs.open w no error");
                var wb = new Uint8Array(3);
                wb[0] = 88; wb[1] = 89; wb[2] = 90;
                fs.write(wfd, wb, 0, 3, null, function (werr, wn, wbBack) {
                    assert(!werr, "fs.write async no error");
                    assert(wn === 3, "async write bytes: " + wn);
                    assert(wbBack === wb, "async write returns same buffer");
                    fs.close(wfd, function () {
                        var v = fs.readFileSync(out, "utf8");
                        assert(v === "XYZ", "async write produced XYZ: " + JSON.stringify(v));
                        try { fs.unlinkSync(out); } catch (_) {}
                        try { fs.unlinkSync(tmp); } catch (_) {}
                        console.log("ok: async open/read/write/close round-trip");
                        console.log("\nfs fd smoke: all assertions passed");
                    });
                });
            });
        });
    });
});
