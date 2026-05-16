// require('.') / require('..') smoke. redis@4 (and any package that
// resolves the current directory's index.js by passing a bare dot) tripped
// over our resolver pre-v1.2.
//
// Spec: real Node treats '.' as './' and '..' as '../', both running
// through LOAD_AS_DIRECTORY — package.json main, then index.js, etc.

var fs = require('fs');
var path = require('path');

// Build a unique temp dir.
var os_tmp = '/tmp';
var unique = 'ionpwr_dot_' + process.pid + '_' + Date.now();
var root = path.join(os_tmp, unique);
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(path.join(root, 'child'), { recursive: true });
fs.mkdirSync(path.join(root, 'child', 'gc'), { recursive: true });

// Root has index.js. Child has its own index.js. Grandchild does the asks.
fs.writeFileSync(path.join(root, 'index.js'),
    "module.exports = { marker: 'root-index' };\n");
fs.writeFileSync(path.join(root, 'child', 'index.js'),
    "module.exports = { marker: 'child-index' };\n");
fs.writeFileSync(path.join(root, 'child', 'gc', 'driver.js'),
    "var dot     = require('.');\n"
    + "var dotdot  = require('..');\n"
    + "var dotslash = require('./');\n"
    + "module.exports = { dot: dot, dotdot: dotdot, dotslash: dotslash };\n");
// gc/index.js — this is what require('.') from driver.js resolves to.
fs.writeFileSync(path.join(root, 'child', 'gc', 'index.js'),
    "module.exports = { marker: 'gc-index' };\n");

var result = require(path.join(root, 'child', 'gc', 'driver.js'));

function eq(label, actual, expected) {
    if (actual !== expected) {
        console.log('FAIL ' + label + ': expected ' + JSON.stringify(expected)
            + ', got ' + JSON.stringify(actual));
        process.exit(1);
    }
}

// require('.') from gc/driver.js → gc/index.js
eq("require('.')",     result.dot.marker,      'gc-index');
// require('..') from gc/driver.js → child/index.js
eq("require('..')",    result.dotdot.marker,   'child-index');
// require('./') from gc/driver.js → gc/index.js (existing behaviour)
eq("require('./')",    result.dotslash.marker, 'gc-index');

// Bonus: require.resolve('.') from the same dir resolves to gc/index.js.
fs.writeFileSync(path.join(root, 'child', 'gc', 'resolver.js'),
    "module.exports = require.resolve('.');\n");
var resolved = require(path.join(root, 'child', 'gc', 'resolver.js'));
if (!/\/gc\/index\.js$/.test(resolved)) {
    console.log("FAIL require.resolve('.') did not end with /gc/index.js: " + resolved);
    process.exit(1);
}

// Cleanup
try {
    fs.unlinkSync(path.join(root, 'child', 'gc', 'driver.js'));
    fs.unlinkSync(path.join(root, 'child', 'gc', 'resolver.js'));
    fs.unlinkSync(path.join(root, 'child', 'gc', 'index.js'));
    fs.rmdirSync(path.join(root, 'child', 'gc'));
    fs.unlinkSync(path.join(root, 'child', 'index.js'));
    fs.rmdirSync(path.join(root, 'child'));
    fs.unlinkSync(path.join(root, 'index.js'));
    fs.rmdirSync(root);
} catch (e) { /* best-effort */ }

console.log("PASS require_dot_smoke (require('.'), require('..'), require('./'), require.resolve('.'))");
