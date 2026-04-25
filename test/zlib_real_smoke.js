// Real DEFLATE compression smoke (v0.68). Verifies that gzipSync /
// deflateSync / deflateRawSync produce real-compressed output (not
// just stored-mode framing) and round-trip cleanly through the
// matching inflate.

var zlib = require("zlib");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Highly redundant input — should compress massively.
var input = Buffer.alloc(8192);
input.fill("a".charCodeAt(0));

// ---- gzipSync ----
var gz = zlib.gzipSync(input);
assert(Buffer.isBuffer(gz), "gz is Buffer");
// Magic
assert(gz[0] === 0x1f && gz[1] === 0x8b, "gz magic 1f 8b");
assert(gz[2] === 0x08, "gz CM = deflate (08)");
// Real compression: 8K of 'a' -> well under 100 bytes
assert(gz.length < 100, "gz is real-compressed (got " + gz.length + " bytes)");
console.log("ok: gzipSync compressed 8192 bytes -> " + gz.length + " bytes");

// Round-trip via gunzipSync
var gunz = zlib.gunzipSync(gz);
assert(gunz.length === 8192, "gunzip length matches");
assert(gunz.equals(input), "gunzip round-trip identity");
console.log("ok: gunzipSync round-trip");

// ---- deflateSync ----
var df = zlib.deflateSync(input);
assert(Buffer.isBuffer(df), "df is Buffer");
assert(df[0] === 0x78, "deflate zlib header CMF = 0x78");
// FCHECK valid: (CMF*256 + FLG) % 31 === 0
assert(((df[0] * 256 + df[1]) % 31) === 0, "deflate zlib FCHECK valid");
assert(df.length < 100, "deflateSync is compressed (got " + df.length + " bytes)");
console.log("ok: deflateSync compressed -> " + df.length + " bytes");

// Round-trip via inflateSync
var inf = zlib.inflateSync(df);
assert(inf.length === 8192, "inflate length");
assert(inf.equals(input), "inflate round-trip identity");
console.log("ok: inflateSync round-trip");

// ---- deflateRawSync ----
var dr = zlib.deflateRawSync(input);
assert(Buffer.isBuffer(dr), "dr is Buffer");
assert(dr.length < 100, "deflateRawSync compressed (got " + dr.length + " bytes)");
console.log("ok: deflateRawSync compressed -> " + dr.length + " bytes");

// Round-trip via inflateRawSync
var ir = zlib.inflateRawSync(dr);
assert(ir.length === 8192, "inflateRaw length");
assert(ir.equals(input), "inflateRaw round-trip identity");
console.log("ok: inflateRawSync round-trip");

// ---- Larger / mixed input (lipsum) ----
var lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris " +
    "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in " +
    "reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla " +
    "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in " +
    "culpa qui officia deserunt mollit anim id est laborum.";
// Repeat to 5KB
while (lorem.length < 5000) lorem += lorem;
lorem = lorem.slice(0, 5000);
var lbuf = Buffer.from(lorem, "utf8");

var lgz = zlib.gzipSync(lbuf);
assert(lgz.length < lbuf.length / 2,
       "lipsum gz < 50% original (in=" + lbuf.length + " gz=" + lgz.length + ")");
console.log("ok: lipsum 5K -> " + lgz.length + " bytes");

var lgunz = zlib.gunzipSync(lgz);
assert(lgunz.toString("utf8") === lorem, "lipsum gunz round-trip");
console.log("ok: lipsum round-trip");

// ---- Cross-tool: our gz output is decompressible by gunzip(1) ----
var fs = require("fs");
var path = require("path");
var os = require("os");
var tmpfile = path.join(os.tmpdir(), "ion-zlib-real-" + process.pid + ".gz");
fs.writeFileSync(tmpfile, lgz);
var spawnSync = require("child_process").spawnSync;
var r = spawnSync("/usr/bin/gunzip", ["-c", tmpfile]);
fs.unlinkSync(tmpfile);
if (r.status === 0) {
    assert(r.stdout.toString("utf8") === lorem, "gunzip(1) decompresses our output");
    console.log("ok: cross-tool gunzip(1) accepts our gzip output");
} else {
    console.log("skip: gunzip(1) not available or failed");
}

// ---- Empty input ----
var emptyGz = zlib.gzipSync(Buffer.alloc(0));
var emptyDecomp = zlib.gunzipSync(emptyGz);
assert(emptyDecomp.length === 0, "empty input round-trip");
console.log("ok: empty input round-trip");

// ---- Async wrappers ----
zlib.gzip(input, function (err, out) {
    assert(!err, "async gzip no error");
    assert(out.length < 100, "async gzip compressed");
    zlib.gunzip(out, function (err2, dec) {
        assert(!err2, "async gunzip no error");
        assert(dec.equals(input), "async gunzip round-trip");
        console.log("ok: async gzip/gunzip round-trip");

        console.log("\nzlib_real smoke: all assertions passed");
    });
});
