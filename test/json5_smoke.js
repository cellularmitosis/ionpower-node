// Smoke test: json5 (lenient JSON) on ionpower-node.
const JSON5 = require("./vendor/json5.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else    { failed++; console.error("FAIL: " + label +
                                      "\n  got:  " + JSON.stringify(got) +
                                      "\n  want: " + JSON.stringify(want)); }
}

// JSON5 accepts plain JSON.
eq("strict JSON", JSON5.parse('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] });

// Unquoted keys.
eq("unquoted keys", JSON5.parse("{a: 1, b: 2}"),   { a: 1, b: 2 });

// Single-quoted strings.
eq("single quotes", JSON5.parse("{a: 'hi'}"),      { a: "hi" });

// Trailing commas.
eq("trailing comma", JSON5.parse("[1, 2, 3,]"),     [1, 2, 3]);

// Comments.
eq("line comment",
   JSON5.parse("{ /* inline */ a: 1, // trailing\nb: 2 }"),
   { a: 1, b: 2 });

// Hex numbers.
eq("hex number", JSON5.parse("{mask: 0xff}"), { mask: 255 });

// Leading / trailing decimal points.
eq("trailing dot",  JSON5.parse("[1.]"),   [1]);
eq("leading dot",   JSON5.parse("[.5]"),   [0.5]);

// Stringify round-trip.
var obj = { a: 1, msg: "hi", nested: { ok: true, tags: ["x", "y"] } };
var s = JSON5.stringify(obj);
eq("stringify round-trip", JSON5.parse(s), obj);

// Pretty-print indentation.
var pretty = JSON5.stringify({a: 1, b: [2, 3]}, null, 2);
eq("pretty indent", pretty.indexOf("\n  a:") >= 0, true);

console.log("\njson5 smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
