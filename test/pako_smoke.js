// Smoke test: pako (mature zlib port) on ionpower-node.
// Interesting comparison against fflate (which we saw has a big-endian
// issue). pako ships from the Nodeca team and has been around since
// 2014; if any JS zlib is big-endian-safe, it's this one.

const pako = require("./vendor/pako.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

function strToBytes(s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; ++i) a[i] = s.charCodeAt(i) & 0xff;
    return a;
}
function bytesToStr(a) {
    var s = "";
    for (var i = 0; i < a.length; ++i) s += String.fromCharCode(a[i]);
    return s;
}

// Highly compressible large corpus — the same one fflate stumbled on.
var corpus = "";
for (var i = 0; i < 200; ++i) corpus += "hello world " + (i % 10) + "\n";
var bytes = strToBytes(corpus);
console.log("corpus:", corpus.length, "bytes");

// deflate + inflate
var deflated = pako.deflate(bytes, { level: 6 });
console.log("pako.deflate:", deflated.length, "bytes (ratio " +
    (100 * deflated.length / bytes.length).toFixed(1) + "%)");
var inflated = pako.inflate(deflated);
assert(bytesToStr(inflated) === corpus, "deflate/inflate round-trip");
console.log("ok: deflate/inflate round-trip on 2800-byte corpus");

// gzip + ungzip.
var gz = pako.gzip(bytes);
assert(gz[0] === 0x1f && gz[1] === 0x8b, "gzip magic");
var gunz = pako.ungzip(gz);
assert(bytesToStr(gunz) === corpus, "gzip/ungzip round-trip");
console.log("ok: gzip/ungzip");

// Varied inputs: short empty, all-ASCII, Unicode (kept to Latin-1 range).
var empty = pako.ungzip(pako.gzip(""));
assert(empty.length === 0, "empty string round-trip");

var checksums = [
    "a", "b", "ab", "abc", "hello", "hello world"
];
for (var j = 0; j < checksums.length; ++j) {
    var s = checksums[j];
    var rt = bytesToStr(pako.inflate(pako.deflate(strToBytes(s))));
    assert(rt === s, "round-trip: '" + s + "'");
}
console.log("ok: short-input round-trips (" + checksums.length + ")");

// String-in-string-out shortcut.
var sdef = pako.deflate(corpus);
var sinf = pako.inflate(sdef, { to: "string" });
assert(sinf === corpus, "to:'string' round-trip");
console.log("ok: string in / string out convenience");

console.log("\npako smoke: all assertions passed");
