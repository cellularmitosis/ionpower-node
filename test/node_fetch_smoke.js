// node_fetch_smoke.js — verify the vendored node-fetch v2 works
// against our http + https modules.
//
// Three round-trips:
//   1. Local http server (GET, JSON body parse)
//   2. Local http server (POST with JSON body)
//   3. https://example.com/ (real public TLS endpoint)

var http = require('http');
var fetch = require('./vendor/node-fetch/node_modules/node-fetch');
var assert = require('assert');

var t0 = Date.now();
var checks = 0;

console.log('node-fetch loaded');

var server = http.createServer(function (req, res) {
    var bodyChunks = [];
    req.on('data', function (c) { bodyChunks.push(c); });
    req.on('end', function () {
        var body = Buffer.concat(bodyChunks).toString('utf8');
        var payload = JSON.stringify({
            url:    req.url,
            method: req.method,
            body:   body
        });
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        });
        res.end(payload);
    });
});

server.listen(0, '127.0.0.1', function () {
    var port = server.address().port;
    console.log('ok: local echo server on :' + port);
    checks++;

    fetch('http://127.0.0.1:' + port + '/get?q=1').then(function (res) {
        console.log('ok: GET status ' + res.status);
        assert.strictEqual(res.status, 200);
        checks++;
        return res.json();
    }).then(function (data) {
        assert.strictEqual(data.url, '/get?q=1');
        assert.strictEqual(data.method, 'GET');
        checks++;
        console.log('ok: GET round-trip + .json()');

        return fetch('http://127.0.0.1:' + port + '/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg: 'hi from node-fetch' })
        });
    }).then(function (res) {
        console.log('ok: POST status ' + res.status);
        assert.strictEqual(res.status, 200);
        checks++;
        return res.json();
    }).then(function (data) {
        assert.strictEqual(data.method, 'POST');
        var bodyData = JSON.parse(data.body);
        assert.strictEqual(bodyData.msg, 'hi from node-fetch');
        checks++;
        console.log('ok: POST round-trip with JSON body');

        server.close();
        return fetch('https://example.com/');
    }).then(function (res) {
        console.log('ok: HTTPS GET status ' + res.status);
        assert.strictEqual(res.status, 200);
        checks++;
        return res.text();
    }).then(function (body) {
        assert(body.indexOf('Example Domain') >= 0, 'missing Example Domain');
        checks++;
        console.log('ok: HTTPS body contains "Example Domain"');

        console.log('node-fetch smoke: ok (' + checks + ' checks, ' + (Date.now() - t0) + ' ms)');
        process.exit(0);
    }).catch(function (e) {
        console.error('error: ' + (e && e.message));
        if (e && e.stack) console.error(e.stack);
        process.exit(1);
    });
});

server.on('error', function (e) {
    console.error('server error: ' + e.message);
    process.exit(1);
});
