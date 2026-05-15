// Get the FULL registry doc (no install-v1 header), so we get the same
// compressed payload that node-fetch-npm gets.

var https = require('https');
var fs = require('fs');
var zlib = require('zlib');

var URL = process.argv[2] || 'https://registry.npmjs.org/express';
var OUT = process.argv[3] || '/tmp/express-meta-full.gz';

var u = require('url').parse(URL);

https.get({
  host: u.hostname, path: u.path, port: 443,
  headers: {
    'Accept-Encoding': 'gzip,deflate',
    'User-Agent': 'ionpower-node-cap-full/1.0'
    // no Accept header — defaults
  }
}, function (res) {
  console.error('full: status=' + res.statusCode + ' encoding=' + res.headers['content-encoding']);
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    var buf = Buffer.concat(chunks);
    console.error('full: gz bytes=' + buf.length + ' first16=' + buf.slice(0, 16).toString('hex') + ' last8=' + buf.slice(buf.length - 8).toString('hex'));
    fs.writeFileSync(OUT, buf);
    try {
      var out = zlib.gunzipSync(buf);
      console.error('full: gunzipSync OK, decompressed bytes=' + out.length);
    } catch (e) {
      console.error('full: gunzipSync FAIL: ' + e.message);
    }
    process.exit(0);
  });
}).on('error', function (e) { console.error('full: REQ FAIL ' + e.message); process.exit(1); });
