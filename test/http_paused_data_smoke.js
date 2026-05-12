// http_paused_data_smoke.js — guards the pass-6 IncomingMessage
// buffering fix. The bug: when user code attaches the 'data' listener
// even one microtask after the response callback fires (the universal
// Promise pattern in pacote / node-fetch / make-fetch-happen), our
// _ClientRequest's sync feedBody(leftover) emits 'data' to a listener-
// less stream and the bytes get dropped. Fix: _IncomingMessage now
// buffers in paused mode and drains on first 'data' listener attach.
//
// We exercise it locally (no network) by spinning up an http server
// that returns a short body, fetching via http.get inside a
// new Promise(resolve => http.get(url, resolve)), and attaching the
// data listener inside the .then. If the fix regresses, no data/end
// events fire and the smoke times out.
//
// Two patterns:
//   (a) Promise.resolve().then attach — explicit one-microtask delay.
//   (b) Async-via-thenable attach — same effect via a Promise chain.

var http = require('http');
var assert = require('assert');

var PAYLOAD = 'left-pad-equivalent-payload-for-tests';
var srv = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(PAYLOAD);
});

srv.listen(0, '127.0.0.1', function () {
    var addr = srv.address();
    var port = addr.port;

    function getViaPromise(label, cb) {
        var t0 = Date.now();
        new Promise(function (resolve, reject) {
            var req = http.get({ host: '127.0.0.1', port: port, path: '/' },
                function (res) { resolve(res); });
            req.on('error', reject);
        }).then(function (res) {
            // Attach data/end listeners ONE microtask after the response cb.
            // Without the IM buffering fix, these never fire — the
            // leftover body bytes were emitted synchronously inside
            // _ClientRequest's response handler with no listener attached.
            var chunks = [];
            var len = 0;
            res.on('data', function (c) { chunks.push(c); len += c.length; });
            res.on('end', function () {
                var body = Buffer.concat(chunks).toString('utf8');
                assert.strictEqual(res.statusCode, 200,
                    label + ': expected 200, got ' + res.statusCode);
                assert.strictEqual(body, PAYLOAD,
                    label + ': body mismatch: got [' + body + ']');
                console.log('ok: ' + label + ' got ' + len + ' bytes in ' +
                    (Date.now() - t0) + ' ms');
                cb();
            });
        }).catch(function (err) {
            assert.fail(label + ': promise rejected: ' + err.message);
        });
    }

    function getViaResumeLate(label, cb) {
        // Variant: also test the .resume() path (attach 'data' AND
        // call resume() after a microtask). Same expected outcome.
        var t0 = Date.now();
        new Promise(function (resolve) {
            http.get({ host: '127.0.0.1', port: port, path: '/' },
                function (res) { resolve(res); });
        }).then(function (res) {
            var chunks = [];
            res.on('data', function (c) { chunks.push(c); });
            res.on('end', function () {
                var body = Buffer.concat(chunks).toString('utf8');
                assert.strictEqual(body, PAYLOAD, label + ': body mismatch');
                console.log('ok: ' + label + ' got ' + body.length +
                    ' bytes in ' + (Date.now() - t0) + ' ms');
                cb();
            });
            res.resume();
        });
    }

    getViaPromise('promise.then', function () {
        getViaResumeLate('promise.then+resume', function () {
            console.log('http paused-data smoke: ok');
            clearTimeout(watchdog);
            srv.close();
            process.exit(0);
        });
    });
});

var watchdog = setTimeout(function () {
    console.error('http_paused_data_smoke: TIMEOUT — IncomingMessage ' +
        'buffering likely regressed');
    process.exit(1);
}, 10000);
