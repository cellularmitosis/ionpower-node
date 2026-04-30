// demos/https/server.js — minimal HTTPS server.
//
// Generates a self-signed cert at startup (RSA-2048, ~6 s on a G3),
// then listens for HTTPS requests. Three routes:
//
//   GET /          → small HTML status page with TLS + request info
//   GET /info      → JSON dump of request headers + TLS metadata
//   GET /echo?msg= → echo back the query
//
// Usage:
//   ./node demos/https/server.js [port]     # port defaults to 8443
//
// Browser test: open https://<host>:8443/ — accept the self-signed cert
// warning. CLI test: see demos/https/client.js.

var https = require('https');
var tls   = require('tls');
var url   = require('url');

var port = parseInt(process.argv[2], 10) || 8443;

console.error('starting demos/https server on :' + port);
console.error('generating self-signed RSA-2048 cert (slow on G3 ~6 s)...');
var t0 = Date.now();
var pair = tls.generateSelfSigned('ionpower-https-demo', 30);
console.error('cert generated in ' + (Date.now() - t0) + ' ms');

var startedAt = new Date().toISOString();

function htmlPage(reqInfo, tlsInfo) {
    return [
        '<!doctype html>',
        '<html><head>',
        '<meta charset="utf-8">',
        '<title>ionpower-node HTTPS demo</title>',
        '<style>',
        '  body{font-family:system-ui,sans-serif;margin:2em;max-width:60em;background:#fafafa;color:#222}',
        '  h1{font-size:1.4em}',
        '  table{border-collapse:collapse;margin:1em 0}',
        '  td,th{padding:0.3em 0.6em;border:1px solid #ccc;text-align:left;vertical-align:top}',
        '  th{background:#eee}',
        '  code{background:#eee;padding:0 0.3em;border-radius:3px}',
        '  .ok{color:#080}',
        '</style>',
        '</head><body>',
        '<h1><span class="ok">&#x1f512;</span> ionpower-node HTTPS demo</h1>',
        '<p>Served from <code>demos/https/server.js</code>',
        '   on <code>' + process.version + '</code>',
        '   (OpenSSL ' + (process.versions.openssl || '?') + ').</p>',
        '<h2>TLS connection</h2>',
        '<table>',
        '  <tr><th>Protocol</th><td><code>' + tlsInfo.protocol + '</code></td></tr>',
        '  <tr><th>Cipher</th><td><code>' + (tlsInfo.cipher && tlsInfo.cipher.name) + '</code></td></tr>',
        '</table>',
        '<h2>Request</h2>',
        '<table>',
        '  <tr><th>Method</th><td><code>' + reqInfo.method + '</code></td></tr>',
        '  <tr><th>URL</th><td><code>' + reqInfo.url + '</code></td></tr>',
        '  <tr><th>Remote</th><td><code>' + reqInfo.remote + '</code></td></tr>',
        '</table>',
        '<h2>Try</h2>',
        '<ul>',
        '  <li><a href="/info">GET /info</a> — JSON dump of TLS + request</li>',
        '  <li><a href="/echo?msg=hello">GET /echo?msg=hello</a> — echo a query</li>',
        '</ul>',
        '<p><small>Self-signed cert; expect a browser warning. Started at ' + startedAt + '.</small></p>',
        '</body></html>'
    ].join('\n');
}

var server = https.createServer({
    cert: pair.certPem,
    key:  pair.keyPem
}, function (req, res) {
    var u = url.parse(req.url, true);
    var sock = req.socket;
    var tlsInfo = {
        protocol: sock.getProtocol ? sock.getProtocol() : null,
        cipher:   sock.getCipher   ? sock.getCipher()   : null
    };
    var reqInfo = {
        method:  req.method,
        url:     req.url,
        path:    u.pathname,
        query:   u.query,
        headers: req.headers,
        remote:  (sock.address && sock.address().host) || ''
    };

    console.error('[' + new Date().toISOString() + '] ' +
                  req.method + ' ' + req.url + '  (' +
                  tlsInfo.protocol + ' ' +
                  ((tlsInfo.cipher && tlsInfo.cipher.name) || '?') + ')');

    if (u.pathname === '/' || u.pathname === '') {
        var body = htmlPage(reqInfo, tlsInfo);
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(body)
        });
        res.end(body);
        return;
    }

    if (u.pathname === '/info') {
        var payload = JSON.stringify({
            tls:     tlsInfo,
            request: reqInfo,
            server:  {
                runtime: process.version,
                openssl: process.versions.openssl,
                started: startedAt
            }
        }, null, 2) + '\n';
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        });
        res.end(payload);
        return;
    }

    if (u.pathname === '/echo') {
        var msg = (u.query && u.query.msg) || '';
        var out = String(msg);
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': Buffer.byteLength(out)
        });
        res.end(out);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
});

server.on('clientError', function (e, sock) {
    console.error('clientError:', e && e.message ? e.message : e);
    if (sock && sock.destroy) sock.destroy();
});

server.listen(port, '0.0.0.0', function () {
    var addr = server.address();
    console.error('listening on https://' + addr.host + ':' + addr.port + '/');
    console.error('try:   ./node demos/https/client.js  https://127.0.0.1:' + addr.port + '/info');
});
