// tls_smoke.js — connect to example.com:443 over TLS, verify peer cert,
// send a tiny HTTP/1.0 request, parse a few bytes of response. Exits 0
// on success.

var tls = require('tls');
var assert = require('assert');

var checks = 0;
var t0 = Date.now();

var sock = tls.connect({
    host: 'example.com',
    port: 443,
    servername: 'example.com'
}, function () {
    checks++;
    console.log('ok: secureConnect fired');

    var proto = sock.getProtocol();
    console.log('ok: protocol = ' + proto);
    assert(proto === 'TLSv1.2' || proto === 'TLSv1.3', 'expected TLS 1.2 or 1.3');
    checks++;

    var cipher = sock.getCipher();
    console.log('ok: cipher = ' + (cipher && cipher.name));
    assert(cipher && cipher.name && cipher.name.length > 0, 'cipher name empty');
    checks++;

    var cert = sock.getPeerCertificate();
    assert(cert && cert.subject, 'no peer cert');
    console.log('ok: peer subject = ' + cert.subject);
    console.log('ok: peer issuer  = ' + cert.issuer);
    console.log('ok: valid_from   = ' + cert.valid_from);
    console.log('ok: valid_to     = ' + cert.valid_to);
    checks++;

    sock.write('GET / HTTP/1.0\r\nHost: example.com\r\nConnection: close\r\n\r\n');
});

var bodyChunks = [];
var totalBytes = 0;

sock.on('data', function (chunk) {
    totalBytes += chunk.length;
    bodyChunks.push(chunk);
});

sock.on('end', function () {
    var body = Buffer.concat(bodyChunks).toString('utf8');
    assert(body.indexOf('HTTP/1') === 0, 'expected HTTP response, got: ' + body.slice(0, 80));
    console.log('ok: status line = ' + body.split('\r\n')[0]);
    checks++;
    assert(totalBytes > 100, 'expected >100 bytes, got ' + totalBytes);
    console.log('ok: total bytes received = ' + totalBytes);
    checks++;

    var dt = Date.now() - t0;
    console.log('tls smoke: ok (' + checks + ' checks, ' + dt + ' ms)');
});

sock.on('error', function (e) {
    console.error('tls error:', e && e.message ? e.message : e);
    process.exit(1);
});
