// Smoke test: Chance (random data generator) on ionpower-node.
var Chance = require("./vendor/chance.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var chance = new Chance(42);   // seeded for reproducibility

// Integers.
var n = chance.integer({ min: 0, max: 100 });
assert(typeof n === "number" && n >= 0 && n <= 100, "integer in range: " + n);
console.log("ok: integer in range");

// Names.
var name = chance.name();
assert(typeof name === "string" && name.length > 0, "name: " + name);
console.log("ok: name:", name);

// Email.
var email = chance.email();
assert(email.indexOf("@") > 0, "email contains @: " + email);
console.log("ok: email:", email);

// URL.
var url = chance.url();
assert(url.indexOf("://") > 0, "url has scheme: " + url);
console.log("ok: url:", url);

// GUID.
var guid = chance.guid();
assert(/^[0-9a-f-]{36}$/.test(guid), "guid shape: " + guid);
console.log("ok: guid:", guid);

// Date.
var d = chance.date();
assert(d instanceof Date, "date is Date");
console.log("ok: date:", d.toISOString().split("T")[0]);

// Seeded reproducibility.
var c1 = new Chance(1234);
var c2 = new Chance(1234);
var s1 = c1.string({ length: 10 });
var s2 = c2.string({ length: 10 });
assert(s1 === s2, "same seed gives same string: " + s1 + " vs " + s2);
console.log("ok: seeded reproducibility");

console.log("\nchance smoke: all assertions passed");
