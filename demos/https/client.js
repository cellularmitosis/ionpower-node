// demos/https/client.js — minimal HTTPS client.
//
// Fetches a URL over HTTPS and prints the response + TLS metadata.
//
//   ./node demos/https/client.js [URL]
//
// Defaults to https://127.0.0.1:8443/info (paired with server.js).
// Pass any HTTPS URL to fetch from the public web — example.com,
// httpbin.org/ip, etc. With -k it will skip cert validation, useful
// when hitting the demo server's self-signed cert.

var https = require('https');
var url   = require('url');

var args = process.argv.slice(2);
var insecure = false;
var target = null;
for (var i = 0; i < args.length; ++i) {
    if (args[i] === '-k' || args[i] === '--insecure') insecure = true;
    else if (target === null) target = args[i];
}
if (!target) target = 'https://127.0.0.1:8443/info';

var u = url.parse(target);
if (u.protocol !== 'https:') {
    console.error('client: only https:// URLs are supported');
    process.exit(2);
}

// Default to insecure when hitting the local demo server (self-signed
// cert), but require -k for any other host.
if (!insecure && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) {
    insecure = true;
}

var t0 = Date.now();

console.error('GET ' + target + (insecure ? '   (-k: skipping cert validation)' : ''));

var req = https.get({
    hostname: u.hostname,
    port:     parseInt(u.port || 443, 10),
    path:     u.path || '/',
    rejectUnauthorized: !insecure,
    headers: {
        'User-Agent': 'ionpower-https-demo-client',
        'Accept':     'application/json, text/html, */*'
    }
}, function (res) {
    console.error('< HTTP/' + res.httpVersion + ' ' + res.statusCode + ' ' + (res.statusMessage || ''));

    // Print headers in the order received.
    Object.keys(res.headers).forEach(function (k) {
        console.error('< ' + k + ': ' + res.headers[k]);
    });

    var sock = res.socket;
    if (sock) {
        var proto  = sock.getProtocol ? sock.getProtocol() : null;
        var cipher = sock.getCipher   ? sock.getCipher()   : null;
        var cert   = sock.getPeerCertificate ? sock.getPeerCertificate() : null;
        console.error('');
        console.error('---- TLS info ----');
        console.error('  protocol: ' + proto);
        console.error('  cipher:   ' + (cipher && cipher.name));
        if (cert && cert.subject) {
            console.error('  peer cert subject: ' + cert.subject);
            console.error('  peer cert issuer:  ' + cert.issuer);
            console.error('  valid_from: ' + cert.valid_from);
            console.error('  valid_to:   ' + cert.valid_to);
        }
        console.error('------------------');
    }

    var bodyChunks = [];
    res.on('data', function (c) { bodyChunks.push(c); });
    res.on('end', function () {
        var body = Buffer.concat(bodyChunks).toString('utf8');
        var dt = Date.now() - t0;
        // Pretty-print JSON; pass HTML/text through.
        var ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.indexOf('json') >= 0) {
            try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) {}
        }
        process.stdout.write(body);
        if (body.length && body.charAt(body.length - 1) !== '\n') process.stdout.write('\n');
        console.error('\n(' + body.length + ' bytes, ' + dt + ' ms)');
    });
});

req.on('error', function (e) {
    console.error('error: ' + (e && e.message ? e.message : e));
    process.exit(1);
});
