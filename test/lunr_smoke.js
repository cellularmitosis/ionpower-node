// Smoke test: lunr (full-text search) on ionpower-node.
var lunr = require("./vendor/lunr.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var docs = [
    { id: "a", title: "PowerPC Programming",
      body: "Macros and assembler for the PPC architecture." },
    { id: "b", title: "Modern JavaScript",
      body: "Arrow functions, promises, async/await." },
    { id: "c", title: "Mac OS X Tiger Internals",
      body: "Darwin kernel, launchd, and the HFS+ filesystem on the PowerPC Macintosh." },
    { id: "d", title: "Writing a Compiler",
      body: "Lexer, parser, code generation targeting PowerPC assembly." }
];

var idx = lunr(function () {
    this.ref("id");
    this.field("title");
    this.field("body");
    for (var i = 0; i < docs.length; ++i) this.add(docs[i]);
});

// Search that should hit only "powerpc" documents (a, c, d).
var hits = idx.search("powerpc").map(function (r) { return r.ref; }).sort();
console.log("search 'powerpc' ->", JSON.stringify(hits));
assert(hits.indexOf("a") >= 0 && hits.indexOf("c") >= 0 && hits.indexOf("d") >= 0,
       "expected a, c, d to match");
assert(hits.indexOf("b") < 0, "b should not match");

// Exact-phrase / field search.
var titleHits = idx.search("title:tiger").map(function (r) { return r.ref; });
console.log("search 'title:tiger' ->", JSON.stringify(titleHits));
assert(titleHits.indexOf("c") >= 0, "Tiger-in-title matched doc c");

// Wildcard.
var wild = idx.search("powerp*").map(function (r) { return r.ref; }).sort();
console.log("search 'powerp*' ->", JSON.stringify(wild));
assert(wild.length >= 3, "wildcard matches at least 3");

console.log("\nlunr smoke: all assertions passed");
