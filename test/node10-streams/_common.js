// _common.js — minimal shim for upstream Node 10.24.1 test/common surface.
//
// Streams tests under test/node10-streams/ are vendored verbatim from the
// node v10.24.1 source tree (test/parallel/test-stream-*.js), with the
// upstream `require('../common')` rewritten to `require('./_common')`.
// We implement only the helpers the vendored tests actually call. Extend
// this file as more tests get wired in.

'use strict';

const noop = function () {};

// mustCall / mustCallAtLeast / mustNotCall: wrap fn, register a check that
// runs at process exit. Mismatched call counts → exit code 1.
const mustCallChecks = [];

function runCallChecks(exitCode) {
    if (exitCode !== 0) return;
    let failures = 0;
    for (let i = 0; i < mustCallChecks.length; ++i) {
        const ctx = mustCallChecks[i];
        let ok;
        let want;
        if ('minimum' in ctx) {
            ok = ctx.actual >= ctx.minimum;
            want = 'at least ' + ctx.minimum;
        } else if ('maximum' in ctx) {
            ok = ctx.actual <= ctx.maximum;
            want = 'at most ' + ctx.maximum;
        } else {
            ok = ctx.actual === ctx.exact;
            want = 'exactly ' + ctx.exact;
        }
        if (!ok) {
            console.log('Mismatched %s function calls. Expected %s, actual %d.',
                        ctx.name, want, ctx.actual);
            failures++;
        }
    }
    if (failures > 0) process.exit(1);
}

function _mustCallInner(fn, criteria, field) {
    if (typeof fn === 'number') { criteria = fn; fn = noop; }
    else if (fn === undefined) { fn = noop; }
    if (criteria === undefined) criteria = 1;
    if (typeof criteria !== 'number')
        throw new TypeError('Invalid ' + field + ' value: ' + criteria);
    const ctx = { actual: 0, name: fn.name || '<anonymous>' };
    ctx[field] = criteria;
    if (mustCallChecks.length === 0) process.on('exit', runCallChecks);
    mustCallChecks.push(ctx);
    return function () {
        ctx.actual++;
        return fn.apply(this, arguments);
    };
}

function mustCall(fn, exact) { return _mustCallInner(fn, exact, 'exact'); }
function mustCallAtLeast(fn, minimum) { return _mustCallInner(fn, minimum, 'minimum'); }
function mustCallAtMost(fn, maximum) { return _mustCallInner(fn, maximum, 'maximum'); }
function mustNotCall(msg) {
    const m = msg || 'function should not have been called';
    return function () {
        const args = Array.prototype.slice.call(arguments).map(String).join(', ');
        throw new Error(m + ' (args: [' + args + '])');
    };
}

// expectsError({ code, type, message }) returns a function that checks
// any thrown error matches. Used in many tests as the callback for an
// expected-error path or as the second arg to assert.throws.
function expectsError(spec, exact) {
    function check(err) {
        if (typeof spec === 'function') return spec(err);
        if (spec && spec.code !== undefined) {
            if (err.code !== spec.code)
                throw new Error('expected code ' + spec.code + ', got ' + err.code);
        }
        if (spec && spec.type !== undefined) {
            if (!(err instanceof spec.type))
                throw new Error('expected instance of ' + spec.type.name +
                                ', got ' + (err && err.constructor && err.constructor.name));
        }
        if (spec && spec.message !== undefined) {
            if (spec.message instanceof RegExp) {
                if (!spec.message.test(err.message))
                    throw new Error('error message ' + JSON.stringify(err.message) +
                                    ' did not match ' + spec.message);
            } else if (err.message !== spec.message) {
                throw new Error('expected message ' + JSON.stringify(spec.message) +
                                ', got ' + JSON.stringify(err.message));
            }
        }
        return true;
    }
    if (exact !== undefined) return mustCall(check, exact);
    return mustCall(check);
}

// getArrayBufferViews — typed-array zoo used by a handful of write/encoding
// tests. Returns one of each view kind over a copy of buf's bytes.
function getArrayBufferViews(buf) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const views = [
        new Uint8Array(ab), new Int8Array(ab), new Uint8ClampedArray(ab),
        new DataView(ab),
    ];
    if (ab.byteLength % 2 === 0) {
        views.push(new Int16Array(ab), new Uint16Array(ab));
    }
    if (ab.byteLength % 4 === 0) {
        views.push(new Int32Array(ab), new Uint32Array(ab),
                   new Float32Array(ab));
    }
    if (ab.byteLength % 8 === 0) {
        views.push(new Float64Array(ab));
    }
    return views;
}

// printSkipMessage / skip — used when a test is platform-conditional.
function printSkipMessage(msg) { console.log('1..0 # Skipped: ' + msg); }
function skip(msg) { printSkipMessage(msg); process.exit(0); }

// platform flags consumed by some stream tests' early-skip checks.
const isWindows = process.platform === 'win32';
const isOSX = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const isAIX = process.platform === 'aix';
const isFreeBSD = process.platform === 'freebsd';
const isOpenBSD = process.platform === 'openbsd';
const isSunOS = process.platform === 'sunos';

// PIPE: a path tests use for an AF_UNIX socket. We don't need it to be
// functional for the stream tests; just provide a stable string.
const PIPE = (isWindows ? '\\\\?\\pipe\\' : '/tmp/') + 'test-stream-pipe-' + process.pid;

// hasCrypto: used to gate tests that require openssl.
const hasCrypto = !!(process.versions && process.versions.openssl);

// hasIntl: ICU. Not used by streams tests typically; leave false.
const hasIntl = false;

// allowGlobals: track tampering with global namespace. We don't enforce
// the global-leak check; just record the names for compatibility.
const knownGlobals = [];
function allowGlobals() {
    for (let i = 0; i < arguments.length; ++i) knownGlobals.push(arguments[i]);
}

module.exports = {
    mustCall: mustCall,
    mustCallAtLeast: mustCallAtLeast,
    mustCallAtMost: mustCallAtMost,
    mustNotCall: mustNotCall,
    expectsError: expectsError,
    getArrayBufferViews: getArrayBufferViews,
    printSkipMessage: printSkipMessage,
    skip: skip,
    allowGlobals: allowGlobals,
    isWindows: isWindows,
    isOSX: isOSX,
    isLinux: isLinux,
    isAIX: isAIX,
    isFreeBSD: isFreeBSD,
    isOpenBSD: isOpenBSD,
    isSunOS: isSunOS,
    hasCrypto: hasCrypto,
    hasIntl: hasIntl,
    PIPE: PIPE,
};
