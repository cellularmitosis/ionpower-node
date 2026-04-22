// Smoke test: ramda (functional utilities) on ionpower-node.
var R = require("./vendor/ramda.js");

function eq(label, got, want) {
    if (JSON.stringify(got) === JSON.stringify(want)) console.log("ok: " + label);
    else { console.error("FAIL: " + label + "\n  got:  " + JSON.stringify(got) +
                                        "\n  want: " + JSON.stringify(want));
           process.exit(1); }
}

// Currying.
var add = R.curry(function(a, b){ return a + b; });
eq("curry add(2)(3)", add(2)(3), 5);
eq("curry add(2, 3)", add(2, 3), 5);

// Compose / pipe.
var inc = function(n){ return n + 1; };
var dbl = function(n){ return n * 2; };
eq("pipe(inc, dbl)(3)",     R.pipe(inc, dbl)(3),     8);  // (3+1)*2
eq("compose(dbl, inc)(3)",  R.compose(dbl, inc)(3),  8);

// Map / filter over arrays.
eq("map inc",    R.map(inc, [1, 2, 3]),          [2, 3, 4]);
eq("filter odd", R.filter(function(x){ return x % 2 === 1; }, [1,2,3,4]), [1, 3]);

// sortBy + prop
var users = [{age:30,name:"bob"}, {age:25,name:"alice"}, {age:40,name:"carol"}];
eq("sortBy age", R.sortBy(R.prop("age"), users).map(R.prop("name")),
   ["alice","bob","carol"]);

// uniq
eq("uniq", R.uniq([1,2,1,3,2,4]), [1,2,3,4]);

// groupBy
eq("groupBy mod2", R.groupBy(function(n){ return n % 2 === 0 ? "even" : "odd"; }, [1,2,3,4,5,6]),
   { odd:[1,3,5], even:[2,4,6] });

// lenses
var L = R.lensProp("a");
eq("view",  R.view(L, {a:1, b:2}),       1);
eq("set",   R.set(L, 99, {a:1, b:2}),    {a:99, b:2});
eq("over",  R.over(L, inc, {a:1, b:2}),  {a:2, b:2});

console.log("\nramda smoke: all assertions passed");
