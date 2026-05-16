// Block-scoped per-iteration binding smoke. SM45 does not per-iteration-bind
// `let` / `const` in for-in / for-of / for(;;). Pass-18 worked around this
// by triggering babel pre-emptively when a required file contains
// `for (let ...)` or `for (const ...)`; preset-env at targets:{ie:'11'}
// lowers block-scoping to var + IIFE per-iteration, which captures the
// right value.
//
// The smoke verifies the fix by `require`-ing two helper files containing
// the failing patterns. The patterns aren't inlined here because the
// top-level script isn't routed through `__try_babel_transpile__` — only
// `require()` runs the pre-empt path.

var fs = require('fs');
var path = require('path');

var os_tmp = '/tmp';
var unique = 'ionpwr_blockscope_' + process.pid + '_' + Date.now();
var root = path.join(os_tmp, unique);
fs.mkdirSync(root, { recursive: true });

// Helper A — for (const k in obj) capturing k in an arrow.
fs.writeFileSync(path.join(root, 'for_in_const.js'),
    "var obj = { a: 1, b: 2, c: 3 };\n"
    + "var captured = [];\n"
    + "for (const k in obj) captured.push(() => k);\n"
    + "module.exports = captured.map(function (f) { return f(); });\n");

// Helper B — for (let v of arr) capturing v.
fs.writeFileSync(path.join(root, 'for_of_let.js'),
    "var captured = [];\n"
    + "for (let v of [10, 20, 30]) captured.push(() => v);\n"
    + "module.exports = captured.map(function (f) { return f(); });\n");

// Helper C — for (let i = 0; i < N; i++) capturing i.
fs.writeFileSync(path.join(root, 'for_let_i.js'),
    "var captured = [];\n"
    + "for (let i = 0; i < 3; i++) captured.push(() => i);\n"
    + "module.exports = captured.map(function (f) { return f(); });\n");

function arrayEq(label, actual, expected) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
        console.log('FAIL ' + label + ': expected ' + JSON.stringify(expected)
            + ', got ' + JSON.stringify(actual));
        process.exit(1);
    }
    for (var i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
            console.log('FAIL ' + label + '[' + i + ']: expected '
                + JSON.stringify(expected[i]) + ', got ' + JSON.stringify(actual[i]));
            process.exit(1);
        }
    }
}

arrayEq('for-in const',  require(path.join(root, 'for_in_const.js')), ['a', 'b', 'c']);
arrayEq('for-of let',    require(path.join(root, 'for_of_let.js')),   [10, 20, 30]);
arrayEq('for(;;) let',   require(path.join(root, 'for_let_i.js')),    [0, 1, 2]);

// Cleanup.
try {
    fs.unlinkSync(path.join(root, 'for_in_const.js'));
    fs.unlinkSync(path.join(root, 'for_of_let.js'));
    fs.unlinkSync(path.join(root, 'for_let_i.js'));
    fs.rmdirSync(root);
} catch (e) { /* best-effort */ }

console.log('PASS for_loop_block_scope_smoke (for-in const / for-of let / for(;;) let)');
