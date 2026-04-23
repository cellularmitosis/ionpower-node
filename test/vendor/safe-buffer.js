// safe-buffer shim: re-export the built-in Buffer. The real
// safe-buffer package polyfills Buffer.alloc / allocUnsafe / from
// on older Node versions; our runtime's Buffer already has all of
// those, so this is a pass-through.
'use strict';
exports.Buffer = Buffer;
exports.SlowBuffer = Buffer;  // historical alias
exports.INSPECT_MAX_BYTES = 50;
exports.kMaxLength = 0x7fffffff;
