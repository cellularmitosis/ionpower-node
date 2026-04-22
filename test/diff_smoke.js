// Smoke test: diff 5.1.0 (text diffing) on ionpower-node.
// Diff is the workhorse of mocha, jest assertion formatters, and any
// tool that shows "expected vs actual" output. CPU-bound dynamic
// programming — a good JIT target.

const Diff = require("./vendor/diff.js");

var passed = 0, failed = 0;
function ok(label, cond) {
    if (cond) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label); }
}

// diffChars
var chars = Diff.diffChars("foobar", "foobaz");
ok("diffChars: has 3 changes",      chars.length === 3);
ok("diffChars: first chunk equal",  !chars[0].added && !chars[0].removed && chars[0].value === "fooba");
ok("diffChars: second chunk removed 'r'", chars[1].removed && chars[1].value === "r");
ok("diffChars: third chunk added 'z'",    chars[2].added   && chars[2].value === "z");

// diffLines
var before = "a\nb\nc\nd\n";
var after  = "a\nB\nc\nd\n";
var lines  = Diff.diffLines(before, after);
var removedLines = lines.filter(function(c){ return c.removed; }).map(function(c){ return c.value; });
var addedLines   = lines.filter(function(c){ return c.added;   }).map(function(c){ return c.value; });
ok("diffLines removed contains 'b\\n'", removedLines.join("") === "b\n");
ok("diffLines added   contains 'B\\n'", addedLines.join("")   === "B\n");

// diffWords
var w = Diff.diffWords("the quick brown fox", "the quick red fox");
var changedWords = w.filter(function(c){ return c.added || c.removed; }).map(function(c){
    return (c.added ? "+" : "-") + c.value.trim();
});
ok("diffWords identifies brown->red",
   changedWords.indexOf("-brown") >= 0 && changedWords.indexOf("+red") >= 0);

// createPatch
var patch = Diff.createPatch("note.txt", "hello\nworld\n", "hello\nPOWERPC\n", "orig", "new");
ok("createPatch includes 'note.txt'", patch.indexOf("note.txt") >= 0);
ok("createPatch shows - world",       patch.indexOf("-world") >= 0);
ok("createPatch shows + POWERPC",     patch.indexOf("+POWERPC") >= 0);

// applyPatch
var applied = Diff.applyPatch("hello\nworld\n", patch);
ok("applyPatch reproduces target", applied === "hello\nPOWERPC\n");

console.log("\ndiff smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
