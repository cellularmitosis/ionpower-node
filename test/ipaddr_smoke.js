// ipaddr.js: IPv4 + IPv6 parsing / validation / subnet classification.

var ipaddr = require("./vendor/ipaddr.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Validity.
assert(ipaddr.isValid("192.168.0.1"), "ipv4 valid");
assert(!ipaddr.isValid("999.999.999.999"), "ipv4 invalid");
assert(ipaddr.isValid("::1"), "ipv6 valid");
console.log("ok: isValid");

// Parse + range.
var a = ipaddr.parse("192.168.1.1");
assert(a.kind() === "ipv4", "kind ipv4");
assert(a.range() === "private", "192.168/16 is private");
console.log("ok: private range");

var l = ipaddr.parse("127.0.0.1");
assert(l.range() === "loopback", "127/8 is loopback");
console.log("ok: loopback range");

// IPv6.
var v6 = ipaddr.parse("2001:db8::1");
assert(v6.kind() === "ipv6", "kind ipv6");
// "reserved" — 2001:db8::/32 is documentation range.
assert(v6.range() === "reserved", "2001:db8:: is reserved; got " + v6.range());
console.log("ok: ipv6 reserved range");

// toString + toNormalizedString.
assert(v6.toNormalizedString() === "2001:db8:0:0:0:0:0:1" ||
       v6.toNormalizedString() === "2001:0db8:0000:0000:0000:0000:0000:0001",
       "v6 normalized: " + v6.toNormalizedString());
console.log("ok: v6 normalized");

console.log("\nipaddr smoke: all assertions passed");
