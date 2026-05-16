// http2 is a throwing-on-use stub: require('http2') succeeds so packages
// that do `var http2 = require('http2');` at module load (axios@1.x,
// got@11, etc.) can serve HTTP/1.1 through their existing http/https
// adapters. Actual HTTP/2 entry points throw with a clear pointer at
// the recommended workaround.

var http2 = require('http2');

if (!http2 || typeof http2 !== 'object') {
    console.error('FAIL: require(http2) returned', typeof http2);
    process.exit(1);
}
if (typeof http2.connect !== 'function') {
    console.error('FAIL: http2.connect is not a function');
    process.exit(1);
}

var threw = false;
try { http2.connect('https://example.com'); }
catch (e) {
    threw = true;
    if (String(e.message).indexOf('not implemented') < 0) {
        console.error('FAIL: http2.connect threw wrong message:', e.message);
        process.exit(1);
    }
}
if (!threw) {
    console.error('FAIL: http2.connect did not throw');
    process.exit(1);
}

if (typeof http2.constants !== 'object'
    || http2.constants.HTTP_STATUS_OK !== 200
    || http2.constants.HTTP2_HEADER_PATH !== ':path') {
    console.error('FAIL: http2.constants is missing or incomplete:',
                  JSON.stringify(http2.constants));
    process.exit(1);
}

// builtinModules should include 'http2'.
var mod = require('module');
if (mod.builtinModules.indexOf('http2') < 0) {
    console.error('FAIL: module.builtinModules missing "http2"');
    process.exit(1);
}

console.log('ok: http2 stub loads, throws on connect, exposes constants');
console.log('ok: module.builtinModules includes "http2"');
console.log('\nhttp2_stub_smoke: passed');
