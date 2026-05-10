// Trimmed npm 6.14.18 wrapper for ionpower-node v0.87 (Node 10 parity,
// pass 1). Compared to v0.86's wrapper, the runtime now carries:
//   - process.version = 'v10.24.1' (was 'ionpower-node-0.86')
//   - process.versions.node = '10.24.1', process.versions['ionpower-node']
//   - process.execPath
//   - require('constants') with O_*, S_IF*, errno values
//   - process.binding(name) → empty {} stub
//   - fs.readlink / fs.readlinkSync (real readlink(2))
//   - fs.{truncate,symlink,chown,utimes,fchmod} (real syscalls)
//
// What still has to be patched in userland:
//   - Gauge.setWriteTo defense — upstream gauge derefs writeTo.isTTY
//     when log.stream is undefined. Not our gap; root-cause is
//     somewhere in npmconf's default propagation.

// Defend Gauge.setWriteTo against undefined writeTo.
var Gauge = require('/Users/macuser/tmp/npm-6.14.18/node_modules/gauge');
var origSetWriteTo = Gauge.prototype.setWriteTo;
Gauge.prototype.setWriteTo = function (writeTo, tty) {
    return origSetWriteTo.call(this, writeTo || process.stderr, tty);
};

process.on('uncaughtException', function (err) {
    console.error('--- raw uncaughtException ---');
    console.error('name:', err && err.name);
    console.error('message:', err && err.message);
    console.error('stack:', err && err.stack);
    process.exit(99);
});

require('./bin/npm-cli.js');
