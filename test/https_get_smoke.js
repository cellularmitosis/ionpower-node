// https_get_smoke.js — exercise the high-level https.get() against
// example.com. Verifies the parser, headers, body, and 200 status code.

var https = require('https');
var assert = require('assert');

var t0 = Date.now();
var checks = 0;

var req = https.get({
    hostname: 'example.com',
    port: 443,
    path: '/',
    headers: { 'User-Agent': 'ionpower-node-tls-smoke' }
}, function (res) {
    checks++;
    console.log('ok: response received');
    console.log('ok: statusCode = ' + res.statusCode);
    assert.strictEqual(res.statusCode, 200, 'expected 200');
    checks++;

    assert(res.headers['content-type'], 'no content-type header');
    console.log('ok: content-type = ' + res.headers['content-type']);
    checks++;

    var bodyChunks = [];
    var n = 0;
    res.on('data', function (c) { bodyChunks.push(c); n += c.length; });
    res.on('end', function () {
        var body = Buffer.concat(bodyChunks).toString('utf8');
        assert(n > 200, 'expected >200 bytes, got ' + n);
        console.log('ok: body length = ' + n + ' bytes');
        checks++;
        assert(body.indexOf('Example Domain') >= 0, 'no "Example Domain" in body');
        console.log('ok: body contains "Example Domain"');
        checks++;

        var dt = Date.now() - t0;
        console.log('https.get smoke: ok (' + checks + ' checks, ' + dt + ' ms)');
    });
});

req.on('error', function (e) {
    console.error('https error:', e && e.message ? e.message : e);
    process.exit(1);
});
