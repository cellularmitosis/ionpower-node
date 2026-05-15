// Tiny reproducer for the "Data error" failure surfaced by
// `npm install express` against the live registry.
//
// Bypasses the 141s full install — instead hits ONE registry URL via
// the same make-fetch-happen / node-fetch-npm stack npm uses. raw-body's
// metadata is the URL that fails consistently in the discovery log.
//
// Run on ibookg37 with the v0.95 (or instrumented) runtime:
//   /Users/macuser/tmp/ionpower-node/node \
//     /Users/macuser/tmp/ionpower-node/docs/sessions/.../repro-mfh.js

var path = require('path');

var NPM = '/Users/macuser/tmp/npm-6.14.18/node_modules';

var fetch = require(path.join(NPM, 'make-fetch-happen'));

var URL = process.argv[2] || 'https://registry.npmjs.org/raw-body';
var CACHE = '/Users/macuser/tmp/repro-mfh-cache';

console.error('repro: fetching ' + URL);
console.error('repro: cache at ' + CACHE);

var t0 = Date.now();

fetch(URL, {
  cacheManager: CACHE,
  retry: false
}).then(function (res) {
  console.error('repro: status=' + res.status + ' ' + res.statusText);
  console.error('repro: content-encoding=' + res.headers.get('content-encoding'));
  console.error('repro: content-length=' + res.headers.get('content-length'));
  return res.text();
}).then(function (body) {
  var dt = Date.now() - t0;
  console.error('repro: SUCCESS, body bytes=' + body.length + ' (' + dt + 'ms)');
  // print first 80 chars to confirm it parsed
  console.log(body.slice(0, 80));
  process.exit(0);
}).catch(function (e) {
  var dt = Date.now() - t0;
  console.error('repro: FAIL after ' + dt + 'ms');
  console.error('repro: message=' + e.message);
  console.error('repro: stack=' + e.stack);
  process.exit(1);
});
