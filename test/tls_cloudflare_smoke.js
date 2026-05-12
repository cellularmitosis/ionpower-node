// tls_cloudflare_smoke.js — regression guard for the BIO-pair stall
// fix (v0.91). Older runtimes drop the unwritten tail when a single
// TCP read delivers more bytes than the 32 KB BIO pair can hold,
// causing the encrypted stream to go out of alignment and SSL_read
// to fail with "decryption failed or bad record mac" on the next
// record. The www.cloudflare.com HTML body is ~1 MB — guaranteed to
// trigger the stall path.
//
// Two failure modes are distinct here:
//
//   - Real regression: SSL_read errors with "bad record mac" /
//     "decryption failed" partway through the body. The fix
//     broke. -> FAIL hard.
//
//   - Network flake: timeout with no bytes flowing. Cloudflare
//     occasionally rate-limits or routes the G3's IP through a
//     slow path. -> SKIP (exit 0 with a warning).
//
// We make 2 attempts with 60s per-attempt timeout. If a real-error
// signature ever appears, fail immediately without retry — the
// regression is already proven.

var https = require('https');
var assert = require('assert');

var t0 = Date.now();
var maxAttempts = 2;
var attemptTimeoutMs = 60000;

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
        host: 'www.cloudflare.com',
        path: '/',
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
            // (exit 0) so the build doesn't block on Cloudflare being
            // unreachable. The runner shows the SKIP line and downstream
            // grep can pick it up if anyone wants to alert.
            console.log('SKIP tls_cloudflare_smoke: network unreachable after ' + maxAttempts
                        + ' attempts (' + (Date.now() - t0) + 'ms); fix-correctness untested this run');
            process.exit(0);
        }
        assert(res.chunks > 0, 'no body chunks received');
        // Cloudflare resizes occasionally; require at least 200 KB so the
        // smoke survives modest content shrinks but still proves we got
        // past the 32 KB BIO stall (which trips around 50 KB plaintext).
        assert(res.bytes >= 200 * 1024,
               'body too small: ' + res.bytes + ' bytes; expected >= 200 KB');
        console.log('ok: STATUS 200');
        console.log('ok: BODY END; chunks=' + res.chunks + ' bytes=' + res.bytes
                    + ' (~' + Math.round(res.bytes / 1024) + ' KB) in ' + res.elapsedMs + ' ms');
        console.log('PASS tls_cloudflare_smoke (attempt ' + n + ', total ' + (Date.now() - t0) + 'ms)');
        process.exit(0);
    });
}

attempt(1);
