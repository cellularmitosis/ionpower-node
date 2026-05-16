// require.resolve.paths smoke: Node's require.resolve has a .paths
// helper that returns an array of paths Node would search for a given
// specifier, or null for builtins. We provide a minimal compatible
// shim: ancestor walk of <dir>/node_modules, or null for any pre-seeded
// builtin in __require_cache__.

if (typeof require.resolve !== 'function') {
    console.log('FAIL: require.resolve is not a function: ' + typeof require.resolve);
    process.exit(1);
}

if (typeof require.resolve.paths !== 'function') {
    console.log('FAIL: require.resolve.paths is not a function: '
        + typeof require.resolve.paths);
    process.exit(1);
}

// Builtin → null. Try a few known-seeded names.
var builtins = ['fs', 'path', 'os', 'util', 'crypto'];
for (var i = 0; i < builtins.length; i++) {
    var b = builtins[i];
    var r = require.resolve.paths(b);
    if (r !== null) {
        console.log('FAIL: require.resolve.paths(' + JSON.stringify(b)
            + ') expected null, got ' + JSON.stringify(r));
        process.exit(1);
    }
}

// Non-builtin → array of <ancestor>/node_modules paths, walking up from
// the directory of this script.
var paths = require.resolve.paths('some-pkg-that-does-not-exist');
if (!Array.isArray(paths)) {
    console.log('FAIL: require.resolve.paths(non-builtin) is not an array: '
        + (paths === null ? 'null' : typeof paths));
    process.exit(1);
}
if (paths.length === 0) {
    console.log('FAIL: require.resolve.paths(non-builtin) returned an empty array');
    process.exit(1);
}
// Every entry should end with '/node_modules'.
for (var j = 0; j < paths.length; j++) {
    if (!/\/node_modules$/.test(paths[j])) {
        console.log('FAIL: require.resolve.paths[' + j + '] does not end in /node_modules: '
            + paths[j]);
        process.exit(1);
    }
}

console.log('PASS require_resolve_paths_smoke ('
    + builtins.length + ' builtins → null; '
    + paths.length + ' ancestor node_modules dirs)');
