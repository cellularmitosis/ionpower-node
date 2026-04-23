// is-email: loose RFC 5322 email matcher.

var isEmail = require("./vendor/is-email.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(isEmail("user@example.com") === true, "basic email valid");
assert(isEmail("a.b+c@sub.example.co") === true, "email with + and dots");
assert(isEmail("invalid") === false, "missing @");
assert(isEmail("@no-local.com") === false, "empty local-part");
assert(isEmail("user@") === false, "empty domain");
assert(isEmail("") === false, "empty string");
console.log("ok: is-email (6 cases)");

console.log("\nis-email smoke: all assertions passed");
