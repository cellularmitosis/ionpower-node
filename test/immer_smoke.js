// Smoke test: immer (immutable updates via draft proxies) on ionpower-node.
// immer needs ES2015 Proxy — which SM45 has.
var immer = require("./vendor/immer.js");
var produce = immer.produce || immer.default || immer;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Simple object update.
var base = { name: "alice", score: 10, tags: ["a", "b"] };
var next = produce(base, function (draft) {
    draft.score = 20;
    draft.tags.push("c");
});
assert(next.score === 20,             "score updated");
assert(next.tags.length === 3,        "tags length 3");
assert(next.tags[2] === "c",          "last tag = 'c'");
// Base must NOT be mutated.
assert(base.score === 10,             "base score unchanged");
assert(base.tags.length === 2,        "base tags length unchanged");
// Unchanged structure is shared (identity preservation).
assert(next.name === base.name,       "strings identity");
console.log("ok: simple object update with structural sharing");

// Nested object update.
var tree = { root: { left: { v: 1 }, right: { v: 2 } } };
var tree2 = produce(tree, function (draft) { draft.root.left.v = 100; });
assert(tree2.root.left.v === 100,             "left updated");
assert(tree2.root.right === tree.root.right,  "right shared (unchanged path)");
assert(tree.root.left.v === 1,                "original untouched");
console.log("ok: nested update shares unchanged branches");

// Return value form (replace draft).
var x = produce({ a: 1 }, function () { return { a: 99 }; });
assert(x.a === 99, "return-based update");
console.log("ok: explicit return");

console.log("\nimmer smoke: all assertions passed");
