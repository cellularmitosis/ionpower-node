// diff-sequences: Jest's internal Myers-diff engine.

var diffSequences = require("./vendor/diff-sequences.js");
diffSequences = diffSequences.default || diffSequences;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var a = ["apple", "banana", "cherry"];
var b = ["apple", "blackberry", "cherry", "date"];

var aLen = a.length;
var bLen = b.length;

var matches = [];
diffSequences(aLen, bLen,
    function isCommon(aIdx, bIdx) { return a[aIdx] === b[bIdx]; },
    function foundSubseq(n, aStart, bStart) { matches.push({ n: n, aStart: aStart, bStart: bStart }); }
);

assert(matches.length >= 1, "found at least one match: " + matches.length);
// Matches should cover apple (a[0]=b[0]) and cherry (a[2]=b[2]).
var coversApple = matches.some(function (m) { return m.aStart === 0 && m.bStart === 0; });
var coversCherry = matches.some(function (m) { return a[m.aStart] === "cherry"; });
assert(coversApple, "match covers apple");
assert(coversCherry, "match covers cherry");
console.log("ok: matches:", JSON.stringify(matches));

console.log("\ndiff-sequences smoke: all assertions passed");
