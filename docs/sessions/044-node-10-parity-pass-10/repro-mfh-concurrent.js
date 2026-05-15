// Try concurrent fetches against the registry. npm resolves the dep
// tree by fetching many package metadata URLs in parallel — perhaps
// the gunzip "Data error" only surfaces under concurrency.

var path = require('path');
var NPM = '/Users/macuser/tmp/npm-6.14.18/node_modules';
var fetch = require(path.join(NPM, 'make-fetch-happen'));

var URLS = [
  'https://registry.npmjs.org/express',
  'https://registry.npmjs.org/accepts',
  'https://registry.npmjs.org/body-parser',
  'https://registry.npmjs.org/raw-body',
  'https://registry.npmjs.org/finalhandler',
  'https://registry.npmjs.org/qs',
  'https://registry.npmjs.org/serve-static',
  'https://registry.npmjs.org/depd',
  'https://registry.npmjs.org/encodeurl',
  'https://registry.npmjs.org/escape-html',
];

var CACHE = '/Users/macuser/tmp/repro-mfh-cache-c';

console.error('repro-c: ' + URLS.length + ' parallel fetches');

var t0 = Date.now();
var done = 0;
var fail = 0;

URLS.forEach(function (u) {
  fetch(u, { cacheManager: CACHE, retry: false }).then(function (res) {
    return res.text();
  }).then(function (body) {
    ++done;
    console.error('OK   ' + u + '  bytes=' + body.length);
    if (done + fail === URLS.length) finish();
  }).catch(function (e) {
    ++fail;
    console.error('FAIL ' + u + '  ' + e.message);
    if (done + fail === URLS.length) finish();
  });
});

function finish() {
  var dt = Date.now() - t0;
  console.error('--- ' + done + ' OK, ' + fail + ' FAIL in ' + dt + 'ms ---');
  process.exit(fail > 0 ? 1 : 0);
}
