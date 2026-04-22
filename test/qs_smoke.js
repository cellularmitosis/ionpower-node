// Smoke test: qs 6.11.2 (querystring parser/stringifier) on ionpower-node.
const qs = require("./vendor/qs.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label +
                                    "\n  got:  " + JSON.stringify(got) +
                                    "\n  want: " + JSON.stringify(want)); }
}

// parse
eq("parse simple",        qs.parse("a=1&b=2"),         { a: "1", b: "2" });
eq("parse nested",        qs.parse("a[b]=c"),          { a: { b: "c" } });
eq("parse deep nested",   qs.parse("user[addr][city]=Boston"),
                                                        { user: { addr: { city: "Boston" } } });
eq("parse array",         qs.parse("tags[]=one&tags[]=two"),
                                                        { tags: ["one", "two"] });
eq("parse encoded",       qs.parse("greeting=hello%20world"),
                                                        { greeting: "hello world" });

// stringify
eq("stringify simple",    qs.stringify({ a: 1, b: 2 }),   "a=1&b=2");
eq("stringify nested",    qs.stringify({ a: { b: "c" } }), "a%5Bb%5D=c");
eq("stringify array",     qs.stringify({ tags: ["x", "y"] }),
                                                          "tags%5B0%5D=x&tags%5B1%5D=y");

// round-trip
var obj = { user: { name: "alice", id: 42 }, tags: ["a", "b"] };
var rt = qs.parse(qs.stringify(obj));
// qs stringifies numbers as strings; relax the check for that.
eq("round-trip name",   rt.user.name, "alice");
eq("round-trip id",     rt.user.id,   "42");
eq("round-trip tags",   rt.tags,      ["a", "b"]);

console.log("\nqs smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
