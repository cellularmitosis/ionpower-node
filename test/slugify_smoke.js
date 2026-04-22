// Smoke test: slugify on ionpower-node.
var slugify = require("./vendor/slugify.js");

function eq(label, got, want) {
    if (got === want) console.log("ok: " + label + " -> " + JSON.stringify(got));
    else { console.error("FAIL: " + label + "\n  got:  " + JSON.stringify(got) +
                                    "\n  want: " + JSON.stringify(want)); process.exit(1); }
}

eq("basic",        slugify("Hello World!"),                     "Hello-World!");
eq("lower",        slugify("HELLO World", { lower: true }),     "hello-world");
eq("strip bang",   slugify("Hi!!", { remove: /[!?.]/g }),        "Hi");
eq("replacement",  slugify("a b c", { replacement: "_" }),       "a_b_c");
eq("unicode",      slugify("caf\u00e9 brut"),                    "cafe-brut");
eq("preserve",     slugify("top/level", { lower: true, strict: true }), "toplevel");

console.log("\nslugify smoke: all assertions passed");
