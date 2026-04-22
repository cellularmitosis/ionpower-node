// Smoke test: spark-md5 on ionpower-node.
const SparkMD5 = require("./vendor/spark-md5.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Classic RFC 1321 test vectors.
assert(SparkMD5.hash("")           === "d41d8cd98f00b204e9800998ecf8427e", "md5('')");
assert(SparkMD5.hash("a")          === "0cc175b9c0f1b6a831c399e269772661", "md5('a')");
assert(SparkMD5.hash("abc")        === "900150983cd24fb0d6963f7d28e17f72", "md5('abc')");
assert(SparkMD5.hash("message digest") === "f96b697d7cb7938d525a2f31aaf161d0", "md5('message digest')");
var quick = "The quick brown fox jumps over the lazy dog";
assert(SparkMD5.hash(quick) === "9e107d9d372bb6826bd81d3542a419d6", "md5('quick fox')");
console.log("ok: RFC 1321 test vectors match (5)");

// Incremental API.
var s = new SparkMD5();
s.append("The quick brown fox ");
s.append("jumps over the lazy dog");
assert(s.end() === "9e107d9d372bb6826bd81d3542a419d6", "incremental append");
console.log("ok: incremental append matches one-shot");

console.log("\nspark-md5 smoke: all assertions passed");
