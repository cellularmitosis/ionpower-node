// wss_smoke.js — wss:// client + server round-trip over TLS.
//
// Generates a self-signed cert, brings up a WebSocketServer({ cert, key }),
// connects a `new WebSocket('wss://...', { rejectUnauthorized: false })`,
// round-trips a message, then closes.

var ws = require('ws');
var tls = require('tls');
var assert = require('assert');

var t0 = Date.now();
console.log('generating self-signed RSA-2048 cert (~3 s on G3)...');
var pair = tls.generateSelfSigned('localhost', 30);
console.log('ok: cert generated (' + (Date.now() - t0) + ' ms)');

var checks = 0;

var server = new ws.WebSocketServer({
    port: 0,
    host: '127.0.0.1',
    cert: pair.certPem,
    key:  pair.keyPem
});

server.on('connection', function (sock) {
    console.log('ok: server got wss connection');
    checks++;
    sock.on('message', function (data) {
        var msg = data.toString ? data.toString() : data;
        console.log('ok: server received: ' + msg);
        checks++;
        sock.send('echo: ' + msg);
    });
    sock.on('close', function () {
        console.log('ok: server saw client close');
        checks++;
    });
});

server.on('listening', function () {
    var port = server.address().port;
    console.log('ok: wss server listening on 127.0.0.1:' + port);
    checks++;

    var client = new ws.WebSocket('wss://127.0.0.1:' + port + '/', {
        rejectUnauthorized: false
    });

    client.onopen = function () {
        console.log('ok: client opened');
        checks++;
        client.send('hello over tls');
    };
    client.onmessage = function (ev) {
        console.log('ok: client received: ' + ev.data);
        assert.strictEqual(ev.data, 'echo: hello over tls');
        checks++;
        client.close();
    };
    client.onclose = function (ev) {
        console.log('ok: client closed (code ' + ev.code + ')');
        checks++;
        // Give the server side a moment to register the close.
        setTimeout(function () {
            console.log('wss smoke: ok (' + checks + ' checks, ' +
                        (Date.now() - t0) + ' ms)');
            server.close();
            process.exit(0);
        }, 100);
    };
    client.onerror = function (e) {
        console.error('client error: ' + (e && e.message ? e.message : e));
        process.exit(1);
    };
});

server.on('error', function (e) {
    console.error('server error: ' + (e && e.message ? e.message : e));
    process.exit(1);
});
