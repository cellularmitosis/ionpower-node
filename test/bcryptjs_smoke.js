// bcryptjs: pure-JS bcrypt implementation. Exercises our crypto
// (randomBytes) + Buffer. Use the sync API.

var bcrypt = require("./vendor/bcryptjs.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Generate a salt + hash a password. Keep the cost low (4) so it
// runs fast on Tiger.
var salt = bcrypt.genSaltSync(4);
assert(typeof salt === "string" && salt.length > 0, "salt generated: " + salt);
assert(salt.indexOf("$2") === 0, "salt has $2 prefix: " + salt);
console.log("ok: bcryptjs.genSaltSync");

var hash = bcrypt.hashSync("correct-horse-battery-staple", salt);
assert(typeof hash === "string" && hash.length > 10, "hash produced: " + hash);
console.log("ok: bcryptjs.hashSync");

// compareSync — check that correct password matches.
assert(bcrypt.compareSync("correct-horse-battery-staple", hash) === true, "correct pw matches");
assert(bcrypt.compareSync("wrong-password", hash) === false, "wrong pw rejected");
console.log("ok: bcryptjs.compareSync (positive + negative)");

// getRounds.
assert(bcrypt.getRounds(hash) === 4, "rounds = 4");
console.log("ok: bcryptjs.getRounds");

console.log("\nbcryptjs smoke: all assertions passed");
