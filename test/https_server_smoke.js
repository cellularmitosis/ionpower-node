// https_server_smoke.js — bring up an HTTPS server with a self-signed
// cert, then make a https.get() request to itself with
// rejectUnauthorized:false (since the cert is self-signed). Verifies
// end-to-end: TLS handshake, HTTP framing, response body.
//
// Because RSA-2048 keygen is slow on G3 (~10-15 s), this smoke uses the
// __tls_native__.generateSelfSigned() helper to create a one-shot cert
// at startup.

var https = require('https');
var tls   = require('tls');
var assert = require('assert');

var t0 = Date.now();
console.log('generating self-signed RSA-2048 cert (slow on G3 ~6 s)...');
var pair = tls.generateSelfSigned('localhost', 30);
console.log('ok: cert generated (' + (Date.now() - t0) + ' ms)');
assert(pair.certPem.indexOf('-----BEGIN CERTIFICATE-----') >= 0, 'no cert PEM');
assert(pair.keyPem.indexOf('-----BEGIN') >= 0, 'no key PEM');

var checks = 0;

var server = https.createServer({
    cert: pair.certPem,
    key:  pair.keyPem
}, function (req, res) {
    console.log('ok: server got request: ' + req.method + ' ' + req.url);
    checks++;
    var body = JSON.stringify({
        hello: 'world',
        path:  req.url,
        method: req.method,
        ua:    req.headers['user-agent']
    });
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
});

server.listen(0, '127.0.0.1', function () {
    var port = server.address().port;
    console.log('ok: server listening on 127.0.0.1:' + port);
    checks++;

    var req = https.get({
        hostname: '127.0.0.1',
        port: port,
        path: '/test/path',
        rejectUnauthorized: false,  // self-signed
        headers: { 'User-Agent': 'ionpower-https-self-test' }
    }, function (res) {
        console.log('ok: client got response: ' + res.statusCode);
        assert.strictEqual(res.statusCode, 200);
        checks++;

        var bodyChunks = [];
        res.on('data', function (c) { bodyChunks.push(c); });
        res.on('end', function () {
            var body = Buffer.concat(bodyChunks).toString('utf8');
            console.log('ok: body = ' + body);
            var parsed = JSON.parse(body);
            assert.strictEqual(parsed.hello, 'world');
            assert.strictEqual(parsed.path, '/test/path');
            assert.strictEqual(parsed.method, 'GET');
            checks++;

            console.log('https server smoke: ok (' + checks + ' checks, ' +
                        (Date.now() - t0) + ' ms)');
            server.close();
            process.exit(0);
        });
    });

    req.on('error', function (e) {
        console.error('client error:', e && e.message ? e.message : e);
        process.exit(1);
    });
});

server.on('error', function (e) {
    console.error('server error:', e && e.message ? e.message : e);
    process.exit(1);
});
