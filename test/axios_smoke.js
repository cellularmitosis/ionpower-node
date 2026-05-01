// axios_smoke.js — verify the vendored axios works against our
// http + https modules. Three round-trips:
//
//   1. local http server (what we control)
//   2. https://example.com/ (real public TLS endpoint)
//   3. local http server with POST + JSON body
//
// Vendored axios 0.27.2 lives under test/vendor/axios/.

var http = require('http');
var axios = require('./vendor/axios/node_modules/axios');
var assert = require('assert');

var t0 = Date.now();
var checks = 0;

console.log('axios version: ' + (axios.VERSION || axios.version || '?'));

// 1. Set up a local http echo server.
var server = http.createServer(function (req, res) {
    var bodyChunks = [];
    req.on('data', function (c) { bodyChunks.push(c); });
    req.on('end', function () {
        var body = Buffer.concat(bodyChunks).toString('utf8');
        var payload = JSON.stringify({
            url:    req.url,
            method: req.method,
            body:   body,
            ua:     req.headers['user-agent']
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

    // Round-trip 1: GET local
    axios.get('http://127.0.0.1:' + port + '/hello?q=1').then(function (resp) {
        console.log('ok: GET status ' + resp.status);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.data.url, '/hello?q=1');
        assert.strictEqual(resp.data.method, 'GET');
        checks += 2;
        console.log('ok: GET local round-trip');

        // Round-trip 2: POST with JSON body
        return axios.post('http://127.0.0.1:' + port + '/post', { msg: 'hi from axios' });
    }).then(function (resp) {
        console.log('ok: POST status ' + resp.status);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.data.method, 'POST');
        var parsedBody = JSON.parse(resp.data.body);
        assert.strictEqual(parsedBody.msg, 'hi from axios');
        checks += 2;
        console.log('ok: POST round-trip with JSON body');

        server.close();

        // Round-trip 3: real HTTPS to example.com
        return axios.get('https://example.com/');
    }).then(function (resp) {
        console.log('ok: HTTPS GET status ' + resp.status);
        assert.strictEqual(resp.status, 200);
        assert(resp.data.indexOf('Example Domain') >= 0, 'no Example Domain in body');
        checks += 2;
        console.log('ok: HTTPS body contains "Example Domain"');

        console.log('axios smoke: ok (' + checks + ' checks, ' + (Date.now() - t0) + ' ms)');
        process.exit(0);
    }).catch(function (e) {
        console.error('error: ' + (e && e.message ? e.message : e));
        if (e && e.stack) console.error(e.stack);
        process.exit(1);
    });
});

server.on('error', function (e) {
    console.error('server error: ' + (e && e.message ? e.message : e));
    process.exit(1);
});
