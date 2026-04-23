// Push to 500 libraries: is-relative, is-unc-path, unc-path-regex,
// arr-map, arr-filter, arr-flatten@1, make-iterator.

var isRelative = require("./vendor/is-relative.js");
var isUnc = require("./vendor/is-unc-path.js");
var uncRe = require("./vendor/unc-path-regex.js");
var arrMap = require("./vendor/arr-map.js");
var arrFilter = require("./vendor/arr-filter.js");
var arrFlatten2 = require("./vendor/arr-flatten-v2.js");
var makeIter = require("./vendor/make-iterator.js");

isRelative = isRelative.default || isRelative;
isUnc = isUnc.default || isUnc;
arrFlatten2 = arrFlatten2.default || arrFlatten2;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// is-relative.
assert(isRelative("./foo") === true, "./foo relative");
assert(isRelative("/abs")  === false, "/abs absolute");
console.log("ok: is-relative");

// unc-path-regex.
var re = uncRe();
assert(re instanceof RegExp, "regex");
assert(re.test("\\\\server\\share"), "matches UNC-ish");
console.log("ok: unc-path-regex");

// is-unc-path.
assert(isUnc("\\\\server\\share") === true, "UNC detected");
assert(isUnc("/normal/path") === false, "normal path not UNC");
console.log("ok: is-unc-path");

// arr-map / arr-filter.
eq(arrMap([1, 2, 3], function (n) { return n * 2; }), [2, 4, 6], "arr-map");
eq(arrFilter([1, 2, 3, 4], function (n) { return n > 2; }), [3, 4], "arr-filter");
console.log("ok: arr-map + arr-filter");

// arr-flatten@1.
eq(arrFlatten2([1, [2, [3, [4]]]]), [1, 2, 3, 4], "arr-flatten@1");
console.log("ok: arr-flatten@1");

// make-iterator.
assert(typeof makeIter === "function", "make-iterator fn");
var it = makeIter(function (v, i) { return v * 10; });
eq(it(3, 0), 30, "make-iterator returns callable");
console.log("ok: make-iterator");

console.log("\nmilestone500 smoke: all assertions passed");
