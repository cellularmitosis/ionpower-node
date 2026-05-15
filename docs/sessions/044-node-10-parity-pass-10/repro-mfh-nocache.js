// Same as repro-mfh but no cacheManager — cuts cache.put() out of the
// pipe chain. If this WORKS for express, the bug is specific to the
// make-fetch-happen cache.put pump-tee topology.

var path = require('path');
var fetch = require(path.join('/Users/macuser/tmp/npm-6.14.18/node_modules', 'make-fetch-happen'));

var URL = process.argv[2] || 'https://registry.npmjs.org/express';
console.error('repro-nc: ' + URL);
var t0 = Date.now();

fetch(URL, { retry: false }).then(function (res) {
  console.error('repro-nc: status=' + res.status);
  return res.text();
}).then(function (body) {
  var dt = Date.now() - t0;
  console.error('repro-nc: SUCCESS bytes=' + body.length + ' (' + dt + 'ms)');
  console.log(body.slice(0, 80));
  process.exit(0);
}).catch(function (e) {
  console.error('repro-nc: FAIL ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
