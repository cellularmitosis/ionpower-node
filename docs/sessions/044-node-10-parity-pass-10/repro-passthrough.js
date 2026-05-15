// Mirror node-fetch-npm's exact pipe topology: res → PassThrough → gunzip.
// This is the simplest possible repro. If it fails, the bug is in our
// PassThrough or its interaction with our gunzip.

var https = require('https');
var stream = require('stream');
var zlib = require('zlib');
var url = require('url');

var URL = process.argv[2] || 'https://registry.npmjs.org/express';
var u = url.parse(URL);

console.error('repro-pt: GET ' + URL);
var t0 = Date.now();

https.get({
  host: u.hostname,
  path: u.path,
  port: 443,
  headers: { 'Accept-Encoding': 'gzip', 'User-Agent': 'ionpower-node-pt/1.0' }
}, function (res) {
  console.error('repro-pt: status=' + res.statusCode + ' encoding=' + res.headers['content-encoding']);
  var body = res.pipe(new stream.PassThrough());
  body = body.pipe(zlib.createGunzip());
  var out = [];
  body.on('data', function (c) { out.push(c); });
  body.on('end', function () {
    var dt = Date.now() - t0;
    var total = Buffer.concat(out);
    console.error('repro-pt: SUCCESS, decompressed bytes=' + total.length + ' (' + dt + 'ms)');
    console.log(total.toString('utf8').slice(0, 80));
    process.exit(0);
  });
  body.on('error', function (e) {
    var dt = Date.now() - t0;
    console.error('repro-pt: FAIL after ' + dt + 'ms: ' + e.message);
    process.exit(1);
  });
}).on('error', function (e) {
  console.error('repro-pt: REQ FAIL ' + e.message);
  process.exit(1);
});
