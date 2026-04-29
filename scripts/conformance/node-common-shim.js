// Minimal common.js for Node parallel tests run against ionpower-node.
// Replaces the upstream test/common/index.js (1000+ lines) with the
// subset most tests actually use.
//
// Usage: this file is copied into external/node-tests/test/common/index.js
// at sweep time; the original is preserved at index.js.orig.

'use strict';

var assert = require('assert');

var Comparison = function () {};

function mustCall(fn, expected) {
    if (expected === undefined) expected = 1;
    fn = fn || function () {};
    var calls = 0;
    var wrapped = function () {
        calls++;
        return fn.apply(this, arguments);
    };
    wrapped._mustCallExpected = expected;
    wrapped._mustCallCount = function () { return calls; };
    process.on('exit', function () {
        if (calls !== expected) {
            console.error('mustCall: expected ' + expected + ' calls, got ' + calls);
            process.exitCode = 1;
        }
    });
    return wrapped;
}

function mustCallAtLeast(fn, minimum) {
    minimum = minimum || 1;
    fn = fn || function () {};
    var calls = 0;
    var wrapped = function () { calls++; return fn.apply(this, arguments); };
    process.on('exit', function () {
        if (calls < minimum) {
            console.error('mustCallAtLeast: expected >= ' + minimum + ', got ' + calls);
            process.exitCode = 1;
        }
    });
    return wrapped;
}

function mustNotCall(message) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        throw new Error('mustNotCall: ' + (message || '') + ' called with ' + JSON.stringify(args));
    };
}

function mustSucceed(fn) {
    return mustCall(function (err) {
        if (err) throw err;
        if (fn) return fn.apply(this, Array.prototype.slice.call(arguments, 1));
    });
}

function skip(reason) {
    console.log('1..0 # SKIP ' + (reason || ''));
    process.exit(0);
}

function printSkipMessage(reason) { skip(reason); }

function expectsError(opts) {
    return function (err) {
        if (!err) throw new Error('expectsError: no error thrown');
        if (opts.code && err.code !== opts.code)
            throw new Error('expectsError: code ' + err.code + ' != ' + opts.code);
        if (opts.message instanceof RegExp && !opts.message.test(err.message))
            throw new Error('expectsError: message mismatch');
        if (typeof opts.message === 'string' && err.message !== opts.message)
            throw new Error('expectsError: message ' + err.message + ' != ' + opts.message);
        return true;
    };
}

function invalidArgTypeHelper(input) {
    if (input === null) return ' Received null';
    if (typeof input === 'string') return ' Received type string (' + input + ')';
    return ' Received type ' + typeof input;
}

// Platform detection -- mimic real Node API.
var isWindows = process.platform === 'win32';
var isMainThread = true;       // Always true in our process-backed worker_threads
var localhostIPv4 = '127.0.0.1';
var hasIntl = false;            // We're built without ICU.
var hasFullICU = false;
var hasMultiLocalhost = false;
var hasIPv6 = false;
var enoughTestMem = true;       // 640 MB on G3 is fine for parallel tests
var enoughTestCpu = false;      // PowerPC G3 isn't a fast modern CPU

function platformTimeout(ms) {
    // Tests use this to stretch timeouts on slow CI. PPC G3 is slow.
    return ms * 8;
}

function getArrayBufferViews() {
    var arrays = [Int8Array, Uint8Array, Uint8ClampedArray,
                  Int16Array, Uint16Array, Int32Array, Uint32Array,
                  Float32Array, Float64Array, DataView];
    var ab = new ArrayBuffer(32);
    return arrays.map(function (View) {
        return View === DataView ? new DataView(ab) : new View(ab);
    });
}

// Empty-or-stub for things tests reach for that we just don't have.
function noop() {}

module.exports = {
    mustCall: mustCall,
    mustCallAtLeast: mustCallAtLeast,
    mustNotCall: mustNotCall,
    mustSucceed: mustSucceed,
    skip: skip,
    printSkipMessage: printSkipMessage,
    expectsError: expectsError,
    invalidArgTypeHelper: invalidArgTypeHelper,
    isWindows: isWindows,
    isLinux: process.platform === 'linux',
    isOSX: process.platform === 'darwin',
    isAIX: false,
    isFreeBSD: false,
    isOpenBSD: false,
    isSunOS: false,
    isMainThread: isMainThread,
    localhostIPv4: localhostIPv4,
    PORT: 12346,
    hasIntl: hasIntl,
    hasFullICU: hasFullICU,
    hasMultiLocalhost: hasMultiLocalhost,
    hasIPv6: hasIPv6,
    enoughTestMem: enoughTestMem,
    enoughTestCpu: enoughTestCpu,
    hasCrypto: true,
    hasFipsCrypto: false,
    hasOpenSSL3: false,
    hasOpenSSL31: false,
    hasOpenSSL32: false,
    hasOpenSSL35: false,
    hasOpenSSL: function () { return false; },        // we don't have OpenSSL at all
    hasQuic: false,
    hasInspector: false,
    rootDir: '/',
    platformTimeout: platformTimeout,
    nodeProcessAborted: function () { return false; },
    spawnPromisified: function () { throw new Error('spawnPromisified: not supported'); },
    childShouldThrowAndAbort: noop,
    getArrayBufferViews: getArrayBufferViews,
    getBufferSources: getArrayBufferViews,
    crashOnUnhandledRejection: noop,
    expectWarning: noop,
    canCreateSymLink: function () { return true; },
    fileExists: function (p) {
        try { require('fs').accessSync(p); return true; } catch (e) { return false; }
    },
    runWithInvalidFD: noop,
    getTTYfd: function () { return -1; },
    isInsideDirWithUnusualChars: false,
    buildType: 'Release',
    parseTestFlags: function () { return []; },
    isDumbTerminal: false
};

// Common modules sometimes accessed directly.
module.exports.duplexpair = function () {
    throw new Error('common.duplexpair: not implemented');
};
