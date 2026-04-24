// Wave 2: crypto additions (sha224, randomInt, scryptSync stub) +
// string_decoder partial-multibyte buffering.

var crypto = require("crypto");
var StringDecoder = require("string_decoder").StringDecoder;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- sha224 ---
// FIPS 180-2 known vector: SHA-224 of "abc"
// = 23097d22 3405d822 8642a477 bda255b3 2aadbce4 bda0b3f7 e36c9da7
var sha224abc = crypto.createHash("sha224").update("abc").digest("hex");
eq(sha224abc,
   "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
   "sha224 of 'abc'");
// Empty input:
// SHA-224 of "" = d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f
eq(crypto.createHash("sha224").update("").digest("hex"),
   "d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f",
   "sha224 of ''");
console.log("ok: sha224");

// --- hmac-sha224 ---
// RFC 4231 test case 1: key=0x0b×20, data="Hi There" => 0x896fb1128abbdf196832107cd49df33f47b4b1169912ba4f53684b22
var key = Buffer.alloc(20); for (var i=0;i<20;++i) key[i]=0x0b;
var mac = crypto.createHmac("sha224", key).update("Hi There").digest("hex");
eq(mac, "896fb1128abbdf196832107cd49df33f47b4b1169912ba4f53684b22",
   "hmac-sha224 RFC 4231 TC1");
console.log("ok: hmac-sha224");

// --- randomInt ---
for (var k = 0; k < 20; ++k) {
    var v = crypto.randomInt(1, 10);
    assert(v >= 1 && v < 10, "randomInt 1..10 range, got " + v);
}
// one-arg form
var v2 = crypto.randomInt(5);
assert(v2 >= 0 && v2 < 5, "randomInt(5) range, got " + v2);
console.log("ok: randomInt");

// --- scrypt stubs throw cleanly ---
var threw = false;
try { crypto.scryptSync("a", "b", 16); } catch (e) { threw = true; }
assert(threw, "scryptSync stub throws");
var asyncErr = null;
crypto.scrypt("a", "b", 16, function (err) { asyncErr = err; });
// Ping event loop by exiting and expecting error — but SM drain handles this
process.on("exit", function () {
    if (!asyncErr) { console.error("FAIL: scrypt cb never fired"); process.exit(1); }
});
console.log("ok: scrypt stubs");

// --- string_decoder partial multibyte ---
var sd = new StringDecoder("utf8");
// 'é' is 0xc3 0xa9 in UTF-8. Split across two writes.
var part1 = sd.write(Buffer.from([0xc3]));
var part2 = sd.write(Buffer.from([0xa9]));
eq(part1, "", "SD partial first write: empty");
eq(part2, "é", "SD second write completes char");

// Full multibyte char that lands ok in one chunk
var sd2 = new StringDecoder("utf8");
eq(sd2.write(Buffer.from("hello é world", "utf8")), "hello é world", "SD full chunk");

// 3-byte char ('€' = e2 82 ac) split 1+2
var sd3 = new StringDecoder("utf8");
eq(sd3.write(Buffer.from([0xe2])),              "", "SD 3byte first part");
eq(sd3.write(Buffer.from([0x82, 0xac])), "€", "SD 3byte rest");

// end() flushes
var sd4 = new StringDecoder("utf8");
sd4.write(Buffer.from([0xe2, 0x82]));
// this is a partial 3-byte; end shouldn't error
var endFlush = sd4.end();
assert(typeof endFlush === "string", "SD end returns string");
console.log("ok: string_decoder partial UTF-8");

console.log("\nwave2_crypto smoke: all assertions passed");
