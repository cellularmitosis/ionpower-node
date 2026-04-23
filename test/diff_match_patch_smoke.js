// diff-match-patch: Google's line/char diff + patch library.

var DMP = require("./vendor/diff-match-patch.js");
var dmp = new DMP.diff_match_patch();

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var a = "The quick brown fox";
var b = "The slow brown dog";

var diff = dmp.diff_main(a, b);
dmp.diff_cleanupSemantic(diff);
assert(Array.isArray(diff), "diff is array");
assert(diff.length > 1, "multiple diff ops: " + diff.length);
console.log("ok: diff produced", diff.length, "ops");

var patches = dmp.patch_make(a, b);
assert(Array.isArray(patches), "patches array");
console.log("ok: patch_make produced", patches.length, "patches");

var patchText = dmp.patch_toText(patches);
assert(patchText.indexOf("@@") >= 0, "unified-diff style header");
console.log("ok: patch_toText:", patchText.slice(0, 80).replace(/\n/g, "\\n"));

var parsed = dmp.patch_fromText(patchText);
assert(parsed.length === patches.length, "patch_fromText roundtrip");
console.log("ok: patch_fromText round-trip");

// Apply.
var r = dmp.patch_apply(patches, a);
assert(r[0] === b, "apply: " + r[0]);
console.log("ok: patch_apply produces target");

console.log("\ndiff-match-patch smoke: all assertions passed");
