// MODULE_NOT_FOUND smoke: when require() can't find a module, the
// thrown Error must carry `.code === 'MODULE_NOT_FOUND'` (and
// `.requireStack`). Modern Node libraries probe `e.code` to
// distinguish a missing optional dep from a real load-time error in
// the resolved module's body.
//
// The pre-pass-16 path threw via JS_ReportError which produced an
// Error with `.code === undefined` — silently breaking that branch
// (caught for lumo session 007).

function check(spec, label) {
    var caught = null;
    try {
        require(spec);
    } catch (e) {
        caught = e;
    }
    if (!caught) {
        console.log('FAIL ' + label + ': no error thrown for ' + JSON.stringify(spec));
        process.exit(1);
    }
    if (!(caught instanceof Error)) {
        console.log('FAIL ' + label + ': thrown value is not an Error: '
            + typeof caught + ' / ' + caught);
        process.exit(1);
    }
    if (caught.code !== 'MODULE_NOT_FOUND') {
        console.log('FAIL ' + label + ': e.code === ' + JSON.stringify(caught.code)
            + ', expected "MODULE_NOT_FOUND"');
        console.log('  message: ' + caught.message);
        process.exit(1);
    }
    if (!('requireStack' in caught)) {
        console.log('FAIL ' + label + ': e.requireStack is missing');
        process.exit(1);
    }
    if (!Array.isArray(caught.requireStack)) {
        console.log('FAIL ' + label + ': e.requireStack is not an array: '
            + typeof caught.requireStack);
        process.exit(1);
    }
    if (typeof caught.message !== 'string' || caught.message.length === 0) {
        console.log('FAIL ' + label + ': empty / non-string message');
        process.exit(1);
    }
}

// Three flavors: relative path, absolute path, bare specifier. All
// must produce MODULE_NOT_FOUND (the rewrap layer in globals.cpp
// catches bare-spec failures and walks vendor dirs — when that walk
// also fails it rethrows the original error, so .code must survive).
check('./this-file-does-not-exist-' + Date.now() + '.js', 'relative');
check('/no/such/absolute/path-' + Date.now() + '.js', 'absolute');
check('this-bare-package-does-not-exist-' + Date.now(), 'bare');

// require.resolve() of a non-existent module must also throw with .code.
var caught = null;
try {
    require.resolve('./still-not-here-' + Date.now() + '.js');
} catch (e) {
    caught = e;
}
if (!caught) {
    console.log('FAIL resolve: no error thrown (require.resolve must throw on miss)');
    process.exit(1);
}
if (caught.code !== 'MODULE_NOT_FOUND') {
    console.log('FAIL resolve: e.code === ' + JSON.stringify(caught.code)
        + ', expected "MODULE_NOT_FOUND"');
    console.log('  message: ' + caught.message);
    process.exit(1);
}

console.log('PASS require_module_not_found_smoke (Error + .code + .requireStack on require + require.resolve)');
