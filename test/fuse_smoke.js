// Fuse.js: fuzzy search. Canonical use case is search boxes / command
// palettes where you want "did you mean X?" without exact matching.

var Fuse = require("./vendor/fuse.js");
Fuse = Fuse.default || Fuse;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var list = [
    { title: "Old Man's War" },
    { title: "The Lock Artist" },
    { title: "HTML Hypertext Markup Language" },
    { title: "A Song of Ice and Fire" },
    { title: "The Lord of the Rings" }
];

var fuse = new Fuse(list, { keys: ["title"], threshold: 0.6 });
var results = fuse.search("war");
assert(results.length >= 1, "war matches something: " + results.length);
assert(results[0].item.title.toLowerCase().indexOf("war") !== -1,
       "top result contains 'war': " + results[0].item.title);
console.log("ok: fuse.search('war') ->", results[0].item.title);

// Typo: "hpyertxet" should still find HTML entry.
var typos = fuse.search("hpyertxet");
assert(typos.length >= 1, "typo matches something");
assert(typos[0].item.title.toLowerCase().indexOf("hypertext") !== -1,
       "typo still finds hypertext: " + typos[0].item.title);
console.log("ok: fuse typo tolerance");

console.log("\nfuse smoke: all assertions passed");
