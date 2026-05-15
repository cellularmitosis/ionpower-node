// Capture the exact gzipped bytes that our gunzip fails on for express.
// Use raw https.get + manual chunk collection (the path that WORKS in
// isolation), then save the bytes. Then attempt gunzipSync on disk and
// see whether it reproduces the Data error in standalone form.

var https = require('https');
var fs = require('fs');
var zlib = require('zlib');

var URL = process.argv[2] || 'https://registry.npmjs.org/express';
var OUT = process.argv[3] || '/tmp/express-meta.gz';

console.error('capture: GET ' + URL);

var u = require('url').parse(URL);

https.get({
  host: u.hostname,
  path: u.path,
  port: 443,
  headers: {
    'Accept-Encoding': 'gzip',
    'User-Agent': 'ionpower-node-capture/1.0',
    'Accept': 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
  }
}, function (res) {
  console.error('capture: status=' + res.statusCode);
  console.error('capture: content-encoding=' + res.headers['content-encoding']);
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    var buf = Buffer.concat(chunks);
    console.error('capture: gz bytes=' + buf.length + ' first16=' + buf.slice(0, 16).toString('hex'));
    fs.writeFileSync(OUT, buf);
    console.error('capture: wrote ' + OUT);
    try {
      var out = zlib.gunzipSync(buf);
      console.error('capture: gunzipSync OK, decompressed bytes=' + out.length);
    } catch (e) {
      console.error('capture: gunzipSync FAIL: ' + e.message);
    }
    process.exit(0);
  });
}).on('error', function (e) {
  console.error('capture: REQ FAIL ' + e.message);
  process.exit(1);
});
