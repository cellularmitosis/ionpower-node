// Smoke test: lodash (swiss-army utility library) on ionpower-node.
// Hits a broad slice of lodash's 200+ functions to catch breadth of
// stdlib support, not depth.

const _ = require("./vendor/lodash.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else    { failed++; console.error("FAIL: " + label +
                                     "\n  got:  " + JSON.stringify(got) +
                                     "\n  want: " + JSON.stringify(want)); }
}

// Array
eq("chunk",    _.chunk([1,2,3,4,5], 2),              [[1,2],[3,4],[5]]);
eq("compact",  _.compact([0, 1, false, 2, "", 3]),    [1, 2, 3]);
eq("flatten",  _.flatten([1, [2, [3, [4]], 5]]),      [1, 2, [3, [4]], 5]);
eq("flattenDeep", _.flattenDeep([1, [2, [3, [4]]]]),   [1, 2, 3, 4]);
eq("uniq",     _.uniq([1, 2, 1, 3, 2]),               [1, 2, 3]);
eq("zip",      _.zip(["a","b"], [1, 2]),              [["a",1], ["b",2]]);

// Collection
eq("map",      _.map([1,2,3], function(n){ return n*2; }), [2,4,6]);
eq("filter",   _.filter([1,2,3,4], function(n){ return n%2; }), [1,3]);
eq("reduce",   _.reduce([1,2,3,4], function(a,b){ return a+b; }, 0), 10);
eq("groupBy",  _.groupBy([1.3, 2.1, 2.4], Math.floor),    {"1":[1.3], "2":[2.1, 2.4]});
eq("countBy",  _.countBy(["a","b","a"]),                  {"a":2, "b":1});
eq("sortBy",   _.sortBy([{n:3},{n:1},{n:2}], "n"),        [{n:1},{n:2},{n:3}]);

// String
eq("camelCase",  _.camelCase("foo-bar baz"),      "fooBarBaz");
eq("kebabCase",  _.kebabCase("fooBarBaz"),        "foo-bar-baz");
eq("snakeCase",  _.snakeCase("fooBarBaz"),        "foo_bar_baz");
eq("startCase",  _.startCase("--foo-bar--"),      "Foo Bar");
eq("padStart",   _.padStart("5", 3, "0"),         "005");
eq("truncate",   _.truncate("hi there friend", { length: 9 }), "hi the...");
eq("template",   _.template("hi <%= name %>")({name:"ppc"}), "hi ppc");

// Object
eq("pick",     _.pick({a:1, b:2, c:3}, ["a","c"]),    {a:1, c:3});
eq("omit",     _.omit({a:1, b:2, c:3}, ["b"]),        {a:1, c:3});
eq("merge",    _.merge({a:1}, {b:2}, {c:3}),           {a:1, b:2, c:3});
eq("invert",   _.invert({a:1, b:2}),                   {"1":"a", "2":"b"});
eq("keys",     _.keys({a:1, b:2}).sort(),              ["a","b"]);

// Function
var debounced = _.once(function () { return 42; });
eq("once-1st",  debounced(), 42);
eq("once-2nd",  debounced(), 42);  // memoized return

// Math
eq("sum",      _.sum([1,2,3,4]),          10);
eq("mean",     _.mean([1,2,3,4]),         2.5);
eq("max",      _.max([3,1,4,1,5,9,2,6]),  9);
eq("min",      _.min([3,1,4,1,5,9,2,6]),  1);

// Lang
eq("isArray",     _.isArray([1,2,3]),              true);
eq("isString",    _.isString("hi"),                true);
eq("isFunction",  _.isFunction(function(){}),      true);
eq("isPlainObj",  _.isPlainObject({a:1}),          true);
eq("cloneDeep",   _.cloneDeep({a:{b:{c:1}}}),      {a:{b:{c:1}}});

console.log("\nlodash smoke: " + passed + "/" + (passed+failed) + " passed");
if (failed) process.exit(1);
