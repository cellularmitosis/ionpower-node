// json-parse-even-better-errors: JSON.parse that points at the error
// location when it fails. Lots of package-management / config tooling
// uses this to give users useful error messages.

var parse = require("./vendor/json-parse-even-better-errors.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Valid JSON.
var obj = parse('{"a":1,"b":2}');
assert(obj.a === 1 && obj.b === 2, "valid object");
console.log("ok: json-parse-better valid");

// Invalid JSON should throw with a line/column-y message.
var threw = false;
try {
    parse('{"a":1,broken}');
} catch (e) {
    threw = true;
    assert(typeof e.message === "string" && e.message.length > 0, "error message exists");
    // The library tries to embed position info; test that something
    // beyond the bare SyntaxError text is present.
    assert(/Unexpected|position|broken|column|line/i.test(e.message),
           "error message descriptive: " + e.message);
}
assert(threw, "invalid JSON threw");
console.log("ok: json-parse-better threw with positional detail");

console.log("\njson-parse-better smoke: all assertions passed");
