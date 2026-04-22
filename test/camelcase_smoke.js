// camelcase: string case conversion.

var camelCase = require("./vendor/camelcase.js");

function eq(actual, expected, msg) {
    if (actual !== expected) {
        console.error("FAIL:", msg, "expected", JSON.stringify(expected), "got", JSON.stringify(actual));
        process.exit(1);
    }
}

eq(camelCase('foo-bar'), 'fooBar', 'dash');
eq(camelCase('foo_bar'), 'fooBar', 'underscore');
eq(camelCase('Foo Bar'), 'fooBar', 'space');
eq(camelCase('FOO-BAR'), 'fooBar', 'all caps');
eq(camelCase(['foo', 'bar']), 'fooBar', 'array input');
eq(camelCase('foo-bar', { pascalCase: true }), 'FooBar', 'pascal');
console.log("ok: 6 camelcase variants");

console.log("\ncamelcase smoke: all assertions passed");
