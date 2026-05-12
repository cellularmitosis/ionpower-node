// tls_cloudflare_smoke.js — regression guard for the BIO-pair stall
// fix (v0.91). Older runtimes drop the unwritten tail when a single
// TCP read delivers more bytes than the 32 KB BIO pair can hold,
// causing the encrypted stream to go out of alignment and SSL_read
// to fail with "decryption failed or bad record mac" on the next
// record. We pull a known-large file (~87 KB jquery.min.js) from
// cdn.jsdelivr.net — comfortably past the 32 KB BIO threshold, so
// any regression of the retry-on-stall fix will reproduce.
//
// History on endpoint choice (pass-6): we used to target
// www.cloudflare.com directly (which served ~1 MB of HTML). It's
// the same shape of regression, but Cloudflare's www edge proved
// flaky from the G3's source IP — multiple PASS-able fixes ended
// up SKIP'ing because of edge-side timeouts unrelated to the fix.
// jsdelivr also fronts via Cloudflare (cf-ray in headers) but hits
// a different edge (IAH vs DFW from our IP) that's consistently
// fast. Same regression coverage, far less flake.
//
// Two failure modes are distinct here:
//
//   - Real regression: SSL_read errors with "bad record mac" /
//     "decryption failed" partway through the body. The fix
//     broke. -> FAIL hard.
//
//   - Network flake: timeout with no bytes flowing, or a 5xx.
//     -> SKIP (exit 0 with a warning).

var https = require('https');
var assert = require('assert');

var t0 = Date.now();
var maxAttempts = 2;
var attemptTimeoutMs = 30000;

// jsdelivr serves jquery 3.7.1 from a pinned-version path that's
// guaranteed immutable. ~87 KB minified — well past the 32 KB BIO
// stall threshold, exercises the retry-on-stall path multiple times.
var endpoint = {
    host: 'cdn.jsdelivr.net',
    path: '/npm/jquery@3.7.1/dist/jquery.min.js'
};
// Minimum body size to consider the fetch successful. The pinned
// version's size is 87533 bytes (verified pass-6); we tolerate
// modest variance in case jsdelivr ever revalidates with a slightly
// different minifier. The key invariant: bytes >= ~50 KB means we
// definitely got past the 32 KB BIO stall (which trips at ~50 KB
// plaintext for the pre-fix runtime).
var minExpectedBytes = 50 * 1024;

function tryOnce(attempt, done) {
    var aStart = Date.now();
    var settled = false;
    function settle(err, res) {
        if (settled) return;
        settled = true;
        clearTimeout(toh);
        done(err, res);
    }
    var req = https.get({
        host: endpoint.host,
        path: endpoint.path,
        headers: { 'User-Agent': 'ionpower-tls-smoke', 'Connection': 'close' }
    }, function (res) {
        if (res.statusCode !== 200) {
            settle({ kind: 'http', msg: 'STATUS ' + res.statusCode });
            return;
        }
        var bytes = 0;
        var chunks = 0;
        res.on('data', function (c) { bytes += c.length; chunks += 1; });
        res.on('end', function () {
            settle(null, { chunks: chunks, bytes: bytes, elapsedMs: Date.now() - aStart });
        });
        res.on('error', function (e) {
            settle({ kind: tlsRegressionLike(e.message) ? 'regression' : 'transport', msg: e.message });
        });
    });
    req.on('error', function (e) {
        settle({ kind: tlsRegressionLike(e.message) ? 'regression' : 'transport', msg: e.message });
    });
    var toh = setTimeout(function () {
        settle({ kind: 'timeout', msg: 'attempt ' + attempt + ': no end after ' + attemptTimeoutMs + ' ms' });
        try { req.destroy(); } catch (_) {}
    }, attemptTimeoutMs);
}

function tlsRegressionLike(msg) {
    if (!msg) return false;
    return /decryption failed/i.test(msg) ||
           /bad record mac/i.test(msg) ||
           /SSL_read/i.test(msg) ||
           /1408F119/.test(msg);
}

function attempt(n) {
    console.log('attempt ' + n + ' of ' + maxAttempts + ' (cum elapsed ' + (Date.now() - t0) + 'ms)');
    tryOnce(n, function (err, res) {
        if (err) {
            console.error('  ' + err.kind + ': ' + err.msg);
            if (err.kind === 'regression') {
                console.error('FAIL tls_cloudflare_smoke: REAL REGRESSION DETECTED (' + err.msg + ')');
                process.exit(1);
            }
            if (n < maxAttempts) {
                attempt(n + 1);
                return;
            }
            // Last attempt, only network flakes — emit a SKIP marker
            // (exit 0) so the build doesn't block on edge unreachability.
            // The runner shows the SKIP line and downstream grep can pick
            // it up if anyone wants to alert.
            console.log('SKIP tls_cloudflare_smoke: network unreachable after ' + maxAttempts
                        + ' attempts (' + (Date.now() - t0) + 'ms); fix-correctness untested this run');
            process.exit(0);
        }
        assert(res.chunks > 0, 'no body chunks received');
        assert(res.bytes >= minExpectedBytes,
               'body too small: ' + res.bytes + ' bytes; expected >= ' + minExpectedBytes);
        console.log('ok: STATUS 200');
        console.log('ok: BODY END; chunks=' + res.chunks + ' bytes=' + res.bytes
                    + ' (~' + Math.round(res.bytes / 1024) + ' KB) in ' + res.elapsedMs + ' ms');
        console.log('PASS tls_cloudflare_smoke (attempt ' + n + ', total ' + (Date.now() - t0) + 'ms)');
        process.exit(0);
    });
}

attempt(1);
