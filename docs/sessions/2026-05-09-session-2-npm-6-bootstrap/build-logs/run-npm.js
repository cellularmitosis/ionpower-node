process.version = 'v10.24.1';
process.versions = process.versions || {};
process.versions.node = '10.24.1';
process.execPath = process.execPath || process.argv[0];
__require_cache__['constants'] = {};

// process.binding(name): legacy private API used by older libs to grab
// internal C++ binding modules. Empty-stub it; libs that ACTUALLY call
// the bound functions will fail later, but module-load succeeds.
process.binding = process.binding || function (name) {
    return {};
};

// fs.readlink stub: pretend nothing is a symlink (EINVAL).
var fs = require('fs');
if (typeof fs.readlink !== 'function') {
    fs.readlink = function (path, opts, cb) {
        if (typeof opts === 'function') { cb = opts; opts = null; }
        var e = new Error('EINVAL: invalid argument, readlink');
        e.code = 'EINVAL'; e.errno = -22; e.syscall = 'readlink'; e.path = path;
        setImmediate(function () { cb(e); });
    };
    fs.readlinkSync = function (path) {
        var e = new Error('EINVAL: invalid argument, readlink ' + path);
        e.code = 'EINVAL';
        throw e;
    };
}

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
