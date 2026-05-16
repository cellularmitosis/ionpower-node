// require.main smoke: when this script runs as the entry, the canonical
// `if (require.main === module)` identity check should be true, and
// `require.main.filename` should match __filename.
//
// Background: pass 16 added a `__require_main_module__` global, stashed
// by LoadModuleFile on the first module it constructs (the entry), and
// exposed via a getter on `require.main`. The getter has to survive the
// two-layer require wrapper in globals.cpp — see the property forwarding
// at the wrapped-require rewrap.

if (!require.main) {
    console.log('FAIL: require.main is falsy:', typeof require.main, require.main);
    process.exit(1);
}

if (typeof require.main !== 'object') {
    console.log('FAIL: require.main is not an object: typeof=' + (typeof require.main));
    process.exit(1);
}

if (require.main.filename !== __filename) {
    console.log('FAIL: require.main.filename mismatch.');
    console.log('  require.main.filename = ' + require.main.filename);
    console.log('  __filename            = ' + __filename);
    process.exit(1);
}

if (require.main !== module) {
    console.log('FAIL: require.main !== module — identity check failed.');
    console.log('  require.main.filename = ' + require.main.filename);
    console.log('  module.filename       = ' + module.filename);
    process.exit(1);
}

if (module.filename !== __filename) {
    console.log('FAIL: module.filename !== __filename');
    console.log('  module.filename = ' + module.filename);
    console.log('  __filename      = ' + __filename);
    process.exit(1);
}

console.log('PASS require_main_smoke (require.main === module, filename=' + __filename + ')');
