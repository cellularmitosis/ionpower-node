// http_no_socket_end_smoke.js — guards the two halves of the pass-7
// "registry-based npm install" fix. They go together:
//
//   (1) Client side: _ClientRequest.end() / _flushBody() used to call
//       socket.end() after writing the request headers. On a TLS
//       connection to Cloudflare, that half-close (TLS close_notify
//       alert + raw SHUT_WR) sometimes races the server's response
//       and gets dropped, causing `npm install <name>` to hang
//       ~5/10 against registry.npmjs.org.
//
//   (2) Server side: with (1) in place, our http server stopped
//       seeing a client FIN on GET requests. Our request body reader
//       falls through to mode='eof' when there's no Content-Length
//       and no Transfer-Encoding (the universal GET case) — and used
//       to wait for sock.on('end') (i.e. client FIN) before emitting
//       'end' on the request. With (1)'s fix the FIN never arrives,
//       so any server handler like `req.on('end', () => res.end())`
//       (which axios_smoke and most real handlers do) hangs forever.
//       Per RFC 7230 §3.3.3 rule 6, a REQUEST with no length headers
//       has body length zero, so we emit 'end' immediately on the
//       server side.
//
// This smoke asserts both:
//   - The client does NOT half-close before getting the response.
//   - The server emits 'end' on a GET request without waiting for FIN.

var http = require('http');
var assert = require('assert');

var clientSawFIN = false;
var serverGotEnd = false;
var srv = http.createServer(function (req, res) {
    req.on('end', function () {
        serverGotEnd = true;
    });
    req.socket.on('end', function () { clientSawFIN = true; });
    // Defer writing the response so server-end vs FIN ordering is
    // visible. A correct GET handler should see 'end' on the request
    // immediately after headers — without waiting for the client FIN.
    setTimeout(function () {
        assert.strictEqual(serverGotEnd, true,
            'regression: server did not emit "end" on GET request without ' +
            'waiting for client FIN (RFC 7230 §3.3.3 rule 6)');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pass-7-no-socket-end-marker');
    }, 80);
});

srv.listen(0, '127.0.0.1', function () {
    var port = srv.address().port;
    var t0 = Date.now();
    var req = http.request({
        host: '127.0.0.1', port: port, path: '/',
        method: 'GET',
        headers: { 'Host': '127.0.0.1', 'Connection': 'close' }
    }, function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
            var body = Buffer.concat(chunks).toString('utf8');
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(body, 'pass-7-no-socket-end-marker');
            assert.strictEqual(clientSawFIN, false,
                'regression: client half-closed before server wrote response');
            console.log('ok: GET round-trip with no client half-close and ' +
                'server-side immediate-end in ' + (Date.now() - t0) + ' ms');
            clearTimeout(watchdog);
            srv.close();
            process.exit(0);
        });
    });
    req.on('error', function (e) {
        console.error('req error: ' + e.message);
        process.exit(1);
    });
    req.end();
});

var watchdog = setTimeout(function () {
    console.error('http_no_socket_end_smoke: TIMEOUT — ' +
        '(1) client half-closed too early, OR (2) server stuck waiting ' +
        'for client FIN to emit "end" on the request');
    process.exit(1);
}, 5000);
