// require.extensions smoke: assert that require.extensions exists,
// is an object, and exposes the three canonical keys ('.js', '.json',
// '.node') as functions. Some older Node packages probe these even
// though require.extensions is deprecated; reading must not throw.

if (typeof require.extensions !== 'object' || require.extensions === null) {
    console.log('FAIL: require.extensions is not an object: ' + typeof require.extensions);
    process.exit(1);
}

var expected = ['.js', '.json', '.node'];
for (var i = 0; i < expected.length; i++) {
    var k = expected[i];
    if (!(k in require.extensions)) {
        console.log('FAIL: require.extensions missing key ' + JSON.stringify(k));
        process.exit(1);
    }
    if (typeof require.extensions[k] !== 'function') {
        console.log('FAIL: require.extensions[' + JSON.stringify(k) + '] is not a function: '
            + typeof require.extensions[k]);
        process.exit(1);
    }
}

// Writes must not throw (handler isn't honoured, but the assignment slot
// has to exist — some packages do `require.extensions['.coffee'] = ...`).
try {
    require.extensions['.coffee'] = function () { return undefined; };
} catch (e) {
    console.log('FAIL: assigning to require.extensions threw: ' + e.message);
    process.exit(1);
}

console.log('PASS require_extensions_smoke (.js, .json, .node present; assignment ok)');
