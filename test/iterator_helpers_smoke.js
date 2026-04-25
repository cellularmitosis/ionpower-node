// Iterator.from + helper methods smoke (ES2024 / Node 22+).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

assert(typeof Iterator !== "undefined", "Iterator global");
assert(typeof Iterator.from === "function", "Iterator.from");

// ---- Iterator.from over array iterator ----
var it = Iterator.from([1, 2, 3, 4, 5]);
assert(typeof it.next === "function", "iter.next");
assert(typeof it.map === "function", "iter.map");

// ---- map ----
eq(Iterator.from([1, 2, 3]).map(function (x) { return x * 10; }).toArray(),
   [10, 20, 30], "map");
console.log("ok: Iterator.from + map");

// ---- filter ----
eq(Iterator.from([1, 2, 3, 4, 5]).filter(function (x) { return x % 2 === 0; }).toArray(),
   [2, 4], "filter");
console.log("ok: filter");

// ---- take ----
eq(Iterator.from([1, 2, 3, 4, 5]).take(3).toArray(),
   [1, 2, 3], "take(3)");
console.log("ok: take");

// ---- drop ----
eq(Iterator.from([1, 2, 3, 4, 5]).drop(2).toArray(),
   [3, 4, 5], "drop(2)");
console.log("ok: drop");

// ---- chain ----
eq(Iterator.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
       .filter(function (x) { return x % 2 === 0; })
       .map(function (x) { return x * x; })
       .take(3)
       .toArray(),
   [4, 16, 36], "filter | map | take chain");
console.log("ok: lazy chain");

// ---- flatMap ----
eq(Iterator.from([1, 2, 3]).flatMap(function (x) { return [x, x * 10]; }).toArray(),
   [1, 10, 2, 20, 3, 30], "flatMap with array");
console.log("ok: flatMap");

// ---- some / every / find ----
assert(Iterator.from([1, 2, 3]).some(function (x) { return x === 2; }), "some matches");
assert(!Iterator.from([1, 2, 3]).some(function (x) { return x === 99; }), "some misses");
assert(Iterator.from([2, 4, 6]).every(function (x) { return x % 2 === 0; }), "every even");
assert(!Iterator.from([1, 2, 3]).every(function (x) { return x === 1; }), "every fails");
assert(Iterator.from([10, 20, 30]).find(function (x) { return x > 15; }) === 20, "find first");
console.log("ok: some / every / find");

// ---- reduce ----
eq(Iterator.from([1, 2, 3, 4]).reduce(function (a, b) { return a + b; }, 0), 10, "reduce sum");
eq(Iterator.from([1, 2, 3, 4]).reduce(function (a, b) { return a + b; }), 10, "reduce no init");
console.log("ok: reduce");

// ---- forEach ----
var collected = [];
Iterator.from([10, 20, 30]).forEach(function (x, i) { collected.push(i + ":" + x); });
eq(collected, ["0:10", "1:20", "2:30"], "forEach");
console.log("ok: forEach");

// ---- iter is iterable (Symbol.iterator returns self) ----
var iter2 = Iterator.from([1, 2, 3]).map(function (x) { return x * 2; });
var arr = [];
for (var v of iter2) arr.push(v);
eq(arr, [2, 4, 6], "for...of works on iterator helper result");
console.log("ok: Symbol.iterator (for...of)");

console.log("\niterator_helpers smoke: all assertions passed");
