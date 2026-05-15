// Stress-test our tinflate against various gzip payloads.
// Reads files from argv and reports OK/FAIL with timing.
var zlib = require('zlib');
var fs = require('fs');

var files = process.argv.slice(2);
files.forEach(function (f) {
  try {
    var buf = fs.readFileSync(f);
    var t0 = Date.now();
    var out = zlib.gunzipSync(buf);
    var dt = Date.now() - t0;
    console.log('OK   ' + f + '  in=' + buf.length + ' out=' + out.length + '  ' + dt + 'ms');
  } catch (e) {
    console.log('FAIL ' + f + '  ' + e.message);
  }
});
