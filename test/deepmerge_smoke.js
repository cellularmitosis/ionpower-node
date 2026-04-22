// Smoke test: deepmerge on ionpower-node.
var deepmerge = require("./vendor/deepmerge.js");

function eq(label, got, want) {
    if (JSON.stringify(got) === JSON.stringify(want)) { console.log("ok: " + label); }
    else { console.error("FAIL: " + label + "\n  got:  " + JSON.stringify(got) +
                                         "\n  want: " + JSON.stringify(want)); process.exit(1); }
}

// Basic object merge.
eq("merge objects", deepmerge({a:1,b:2}, {b:3,c:4}), {a:1, b:3, c:4});

// Deep nested.
eq("deep merge",
   deepmerge({a:{x:1,y:2}}, {a:{y:20,z:30}}),
   {a:{x:1, y:20, z:30}});

// Arrays concatenate by default.
eq("array concat",
   deepmerge({tags:["x","y"]}, {tags:["z"]}),
   {tags:["x","y","z"]});

// Override array strategy.
eq("array replace",
   deepmerge({tags:["x","y"]}, {tags:["z"]},
             { arrayMerge: function(dst, src) { return src; } }),
   {tags:["z"]});

// all() merges many.
eq("merge all three",
   deepmerge.all([{a:1},{b:2},{c:3}]),
   {a:1, b:2, c:3});

// Non-mergeable values replace wholesale.
eq("scalars replace",
   deepmerge({v: 1}, {v: "two"}),
   {v: "two"});

// Nested with arrays.
eq("nested + arrays",
   deepmerge({a:{tags:["x"]}}, {a:{tags:["y"], extra:1}}),
   {a:{tags:["x","y"], extra:1}});

console.log("\ndeepmerge smoke: all assertions passed");
