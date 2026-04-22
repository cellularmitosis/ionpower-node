// Smoke test: he (HTML entities) on ionpower-node.
const he = require("./vendor/he.js");

function eq(label, got, want) {
    if (got === want) { console.log("ok: " + label); }
    else { console.error("FAIL: " + label + "\n  got:  " + JSON.stringify(got) +
                                        "\n  want: " + JSON.stringify(want));
           process.exit(1); }
}

eq("encode basic", he.encode("&<>\"'"), "&#x26;&#x3C;&#x3E;&#x22;&#x27;");
eq("encode named", he.encode("&<>\"'", { useNamedReferences: true }),
   "&amp;&lt;&gt;&quot;&apos;");
eq("decode named", he.decode("&amp;&lt;&gt;&quot;"), "&<>\"");
eq("decode hex",   he.decode("&#x2764;"), "\u2764");      // heart
eq("decode dec",   he.decode("&#10084;"), "\u2764");
eq("encode roundtrip",
   he.decode(he.encode("A & B < C > \"hi\"")),
   "A & B < C > \"hi\"");
eq("escape for attr", he.escape("hello <b>world</b>"),
   "hello &lt;b&gt;world&lt;/b&gt;");
eq("unescape", he.unescape("&amp;&lt;&gt;"), "&<>");

console.log("\nhe smoke: all assertions passed");
