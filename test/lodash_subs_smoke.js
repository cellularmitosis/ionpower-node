// lodash.* individual modules: merge / pick / omit / uniq / groupby /
// sortby / clonedeep / isequal. Each is a self-contained package
// (the npm convention of 'lodash.X' publishing only method X).

var merge     = require("./vendor/lodash-merge.js");
var pick      = require("./vendor/lodash-pick.js");
var omit      = require("./vendor/lodash-omit.js");
var uniq      = require("./vendor/lodash-uniq.js");
var groupBy   = require("./vendor/lodash-groupby.js");
var sortBy    = require("./vendor/lodash-sortby.js");
var cloneDeep = require("./vendor/lodash-clonedeep.js");
var isEqual   = require("./vendor/lodash-isequal.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// merge: recursive deep merge, mutates target.
var t = { a: 1, nested: { b: 2 } };
merge(t, { nested: { c: 3 }, d: 4 });
eq(t, { a: 1, nested: { b: 2, c: 3 }, d: 4 }, "merge deep");
console.log("ok: lodash.merge");

// pick / omit.
var src = { a: 1, b: 2, c: 3, d: 4 };
eq(pick(src, ["a", "c"]), { a: 1, c: 3 }, "pick");
eq(omit(src, ["a", "c"]), { b: 2, d: 4 }, "omit");
console.log("ok: lodash.pick + omit");

// uniq.
eq(uniq([1, 2, 2, 3, 3, 3, 4]), [1, 2, 3, 4], "uniq");
console.log("ok: lodash.uniq");

// groupBy + sortBy.
var people = [{ n: "a", age: 30 }, { n: "b", age: 25 }, { n: "c", age: 30 }];
var g = groupBy(people, function (p) { return p.age; });
eq(Object.keys(g).sort(), ["25", "30"], "groupBy keys");
eq(g[30].length, 2, "30-group size");

var sorted = sortBy(people, ["age"]);
eq(sorted[0].n, "b", "sortBy first = b (age 25)");
console.log("ok: lodash.groupBy + sortBy");

// cloneDeep.
var orig = { x: [1, 2, { y: 3 }], z: "s" };
var c = cloneDeep(orig);
orig.x[2].y = 999;
eq(c.x[2].y, 3, "cloneDeep independence");
console.log("ok: lodash.cloneDeep");

// isEqual.
if (!isEqual({ a: 1, b: [1, 2, 3] }, { a: 1, b: [1, 2, 3] })) {
    console.error("FAIL: isEqual deep");
    process.exit(1);
}
if (isEqual({ a: 1 }, { a: 2 })) {
    console.error("FAIL: isEqual false pos");
    process.exit(1);
}
console.log("ok: lodash.isEqual");

console.log("\nlodash-subs smoke: all assertions passed");
