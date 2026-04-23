// url-template: RFC 6570 URI template expansion.

var mod = require("./vendor/url-template-2.js");
var parse = mod.parseTemplate || mod.default && mod.default.parseTemplate || mod.parse || mod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); } }

// Level 1: simple variable expansion.
var t1 = parse("/users/{id}");
eq(t1.expand({ id: 42 }),          "/users/42",    "simple id");
eq(t1.expand({ id: "jason" }),     "/users/jason", "string id");
console.log("ok: url-template level 1 (simple)");

// Level 2: reserved expansion with `+`.
var t2 = parse("{+base}/path");
eq(t2.expand({ base: "http://example.com" }),
   "http://example.com/path", "level 2 reserved");
console.log("ok: url-template level 2 (reserved)");

// Level 3: multi-var query.
var t3 = parse("/search{?q,page}");
var out = t3.expand({ q: "ion", page: 2 });
assert(out === "/search?q=ion&page=2" || out === "/search?q=ion&page=2",
       "query expand: " + out);
console.log("ok: url-template level 3 (query):", out);

console.log("\nurl-template smoke: all assertions passed");
