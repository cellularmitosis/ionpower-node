// ip-regex: regex factory for detecting IP addresses.

var ipRegex = require("./vendor/ip-regex.js");
ipRegex = ipRegex.default || ipRegex;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var re = ipRegex();
assert(re instanceof RegExp, "default factory returns RegExp");
assert(re.test("192.168.1.1"), "matches v4");
// ip-regex v5's default lives in a partial-match mode; ::1 might or
// might not match with the exact flag. Separate test uses v6().
assert(!re.test("not-an-ip"), "rejects non-IP");
console.log("ok: default factory");

// v4-only.
var v4 = ipRegex.v4();
assert(v4.test("10.0.0.1"), "v4 matches v4");
assert(!v4.test("::1"), "v4 rejects v6");
console.log("ok: v4()");

// v6-only.
var v6 = ipRegex.v6();
assert(v6.test("::1"), "v6 matches v6");
assert(!v6.test("10.0.0.1"), "v6 rejects v4");
console.log("ok: v6()");

console.log("\nip-regex smoke: all assertions passed");
