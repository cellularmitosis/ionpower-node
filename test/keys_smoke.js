// camelcase-keys / decamelize-keys: key-case transformers. Common
// glue in CLI / API layers when going from snake_case JSON to
// camelCase JS or vice versa.

var camelcaseKeys = require("./vendor/camelcase-keys.js");
var decamelizeKeys = require("./vendor/decamelize-keys.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// camelcase-keys
eq(camelcaseKeys({ foo_bar: 1, baz_qux_quux: 2 }),
   { fooBar: 1, bazQuxQuux: 2 }, "camelcase");
eq(camelcaseKeys({ user_name: "a", nested: { foo_bar: 1 } }, { deep: true }),
   { userName: "a", nested: { fooBar: 1 } }, "camelcase deep");
console.log("ok: camelcase-keys");

// decamelize-keys
eq(decamelizeKeys({ fooBar: 1, bazQuxQuux: 2 }),
   { foo_bar: 1, baz_qux_quux: 2 }, "decamelize");
console.log("ok: decamelize-keys");

console.log("\nkeys smoke: all assertions passed");
