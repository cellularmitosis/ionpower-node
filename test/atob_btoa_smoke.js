// atob + btoa: base64 encode/decode (browser API shimmed for Node).

var atob = require("./vendor/atob.js");
var btoa = require("./vendor/btoa.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(btoa("hello"), "aGVsbG8=", "btoa");
eq(atob("aGVsbG8="), "hello", "atob");
// Round-trip.
eq(atob(btoa("The quick brown fox")), "The quick brown fox", "round-trip");
console.log("ok: atob + btoa + round-trip");

console.log("\natob/btoa smoke: all assertions passed");
