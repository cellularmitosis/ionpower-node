// punycode: IDN encoding (RFC 3492).

var punycode = require("./vendor/punycode.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Classic example: münchen → mnchen-3ya.
eq(punycode.encode("münchen"), "mnchen-3ya", "encode münchen");
eq(punycode.decode("mnchen-3ya"), "münchen", "decode münchen");
console.log("ok: münchen round-trip");

// toASCII / toUnicode on a full domain.
eq(punycode.toASCII("münchen.example.com"), "xn--mnchen-3ya.example.com", "toASCII");
eq(punycode.toUnicode("xn--mnchen-3ya.example.com"), "münchen.example.com", "toUnicode");
console.log("ok: münchen.example.com round-trip");

console.log("\npunycode smoke: all assertions passed");
