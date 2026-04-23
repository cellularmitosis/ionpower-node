// is-json: validate a string parses as JSON. Exposes two variants:
//   isJson(str)         - loose regex-based (only objects / arrays-of-objects)
//   isJson.strict(str)  - real JSON.parse pass (covers all JSON values)

var isJson = require("./vendor/is-json.js");
isJson = isJson.default || isJson;
var strict = isJson.strict;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Loose
assert(isJson('{"a":1}') === true, "loose: valid object");
assert(isJson('{invalid}') === false, "loose: garbage rejected");
console.log("ok: is-json loose");

// Strict
assert(strict('{"a":1}') === true, "strict: object");
assert(strict('[1,2,3]') === true, "strict: array");
assert(strict('42') === true, "strict: number");
assert(strict('true') === true, "strict: boolean");
assert(strict('"hello"') === true, "strict: string");
assert(strict('not json') === false, "strict: garbage");
console.log("ok: is-json strict (6 cases)");

console.log("\nis-json smoke: all assertions passed");
