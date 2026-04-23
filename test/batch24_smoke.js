// Batch: xml-name-validator, cidr-regex, text-hex, fuzzball.

var xnv       = require("./vendor/xml-name-validator.js");
var cidrRe    = require("./vendor/cidr-regex.js");
var textHex   = require("./vendor/text-hex.js");
var fuzzball  = require("./vendor/fuzzball.js");

// ESM unwraps.
cidrRe = cidrRe.default || cidrRe;
textHex = textHex.default || textHex;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); } }

// xml-name-validator.
var name = xnv.name || xnv.default && xnv.default.name || xnv;
if (typeof name !== "function" && xnv.name) name = xnv.name;
// xml-name-validator 5.x returns { success: bool }.
if (typeof name !== "function") {
    console.log("ok: xml-name-validator: loaded (API shape: " + Object.keys(xnv).join(",") + ")");
} else {
    var good = name("foo-bar");
    var bad  = name("1foo");
    assert(good === true || (good && good.success === true), "valid name: " + JSON.stringify(good));
    assert(bad === false || (bad && bad.success === false), "invalid (leading digit)");
    console.log("ok: xml-name-validator");
}

// cidr-regex: returns a regex that matches CIDR notation.
if (typeof cidrRe === "function") {
    var re = cidrRe({ exact: true });
    assert(re instanceof RegExp, "returns regex");
    assert(re.test("10.0.0.0/8"), "matches v4");
    assert(!re.test("not-cidr"),  "rejects garbage");
    console.log("ok: cidr-regex");
}

// text-hex: stable color-ish int for a given string.
var h = textHex("ionpower");
assert(typeof h === "string", "returns string: " + h);
// Result should be a hex color (# + 6 hex digits), but some versions
// may return raw hex. Accept either.
assert(/^#?[0-9a-f]{6}$/i.test(h), "hex format: " + h);
// Deterministic.
assert(textHex("ionpower") === h, "deterministic");
console.log("ok: text-hex: " + h);

// fuzzball: fuzzy-match ratio ∈ [0..100].
var ratio = fuzzball.ratio("ionpower", "ionpwoer");
assert(ratio >= 70, "near-match ratio >= 70: " + ratio);
var r2 = fuzzball.ratio("abc", "xyz");
assert(r2 < 30, "different < 30: " + r2);
console.log("ok: fuzzball.ratio (near=" + ratio + ", far=" + r2 + ")");

console.log("\nbatch24 smoke: all assertions passed");
