// Install all Node-compat subsystems onto the global and wire up
// the require() chain so that the entry script runs as a CommonJS module.
//
// Installation order:
//   1. console.
//   2. process.
//   3. fs (native binding as __fs_native__).
//   4. path (native binding as __path_native__).
//   5. Buffer.
//   6. require machinery (__require_native__, __make_require__,
//      __require_cache__).
//   7. timers (setImmediate / setTimeout shims).
//   8. A JS bootstrap that builds the public `fs` / `path` modules and
//      seeds core modules (fs, path, events, util, child_process) into
//      the require cache.

#include "node_compat/globals.h"

#include <stdio.h>

#include "jsapi.h"

namespace ionpower {

// Core-module JS sources, embedded into the binary for zero-setup
// deployment. Each module is a plain CommonJS factory that returns
// via `module.exports = ...`.

static const char kBootstrapJS[] =
    "(function () {\n"
    // ES2015 String.prototype.normalize requires ICU, which we built
    // --without-intl-api. Libraries that call normalize (slugify, diff,
    // some markdown parsers) blow up with 'is not a function'. Install a
    // best-effort polyfill that's identity for ASCII and works
    // approximately for Latin-1 accented chars: we return the string
    // unchanged. This is wrong for true NFC/NFD but keeps most libs
    // running on ASCII/Latin-1 inputs, which is the overwhelming case.
    "  if (typeof String.prototype.normalize !== 'function') {\n"
    "    String.prototype.normalize = function () { return String(this); };\n"
    "  }\n"

    // ES2019 Array.prototype.flat / flatMap — added in Node 11. SM45
    // doesn't have them but they're widely used by modern libraries.
    "  if (typeof Array.prototype.flat !== 'function') {\n"
    "    Array.prototype.flat = function (depth) {\n"
    "      depth = depth === undefined ? 1 : Number(depth) || 0;\n"
    "      var out = [];\n"
    "      (function walk(arr, d) {\n"
    "        for (var i = 0; i < arr.length; ++i) {\n"
    "          if (Array.isArray(arr[i]) && d > 0) walk(arr[i], d - 1);\n"
    "          else out.push(arr[i]);\n"
    "        }\n"
    "      })(this, depth);\n"
    "      return out;\n"
    "    };\n"
    "  }\n"
    "  if (typeof Array.prototype.flatMap !== 'function') {\n"
    "    Array.prototype.flatMap = function (fn, thisArg) {\n"
    "      var mapped = Array.prototype.map.call(this, fn, thisArg);\n"
    "      return mapped.flat(1);\n"
    "    };\n"
    "  }\n"
    // ES2017 Object.entries / Object.values / Object.fromEntries.
    "  if (typeof Object.entries !== 'function') {\n"
    "    Object.entries = function (obj) {\n"
    "      var keys = Object.keys(obj), out = new Array(keys.length);\n"
    "      for (var i = 0; i < keys.length; ++i) out[i] = [keys[i], obj[keys[i]]];\n"
    "      return out;\n"
    "    };\n"
    "  }\n"
    "  if (typeof Object.values !== 'function') {\n"
    "    Object.values = function (obj) {\n"
    "      var keys = Object.keys(obj), out = new Array(keys.length);\n"
    "      for (var i = 0; i < keys.length; ++i) out[i] = obj[keys[i]];\n"
    "      return out;\n"
    "    };\n"
    "  }\n"
    "  if (typeof Object.fromEntries !== 'function') {\n"
    "    Object.fromEntries = function (iter) {\n"
    "      var out = {};\n"
    "      if (Array.isArray(iter)) {\n"
    "        for (var i = 0; i < iter.length; ++i) out[iter[i][0]] = iter[i][1];\n"
    "      } else if (iter && typeof iter.forEach === 'function') {\n"
    "        iter.forEach(function (pair) { out[pair[0]] = pair[1]; });\n"
    "      }\n"
    "      return out;\n"
    "    };\n"
    "  }\n"
    // ES2019 String.prototype.trimStart / trimEnd (aliases of trimLeft/Right).
    "  if (typeof String.prototype.trimStart !== 'function') {\n"
    "    String.prototype.trimStart = String.prototype.trimLeft ||\n"
    "      function () { return String(this).replace(/^\\s+/, ''); };\n"
    "  }\n"
    "  if (typeof String.prototype.trimEnd !== 'function') {\n"
    "    String.prototype.trimEnd = String.prototype.trimRight ||\n"
    "      function () { return String(this).replace(/\\s+$/, ''); };\n"
    "  }\n"

    // --- fs (public shape wrapping the __fs_native__ bindings) ---
    "  var nativeFs = __fs_native__;\n"
    // statSync in Node returns a Stats object whose isFile / isDirectory /
    // isSymbolicLink are METHODS, not bool properties. Our native shim
    // returns them as bools AND also exposes _isFile/_isDirectory/
    // _isSymbolicLink. Wrap to expose the method shape so libraries that
    // call st.isFile() don't TypeError.
    "  function _wrapStats(nativeFn) {\n"
    "    return function () {\n"
    "      var st = nativeFn.apply(this, arguments);\n"
    "      if (!st) return st;\n"
    "      var f = !!st._isFile, d = !!st._isDirectory, l = !!st._isSymbolicLink;\n"
    "      st.isFile          = function () { return f; };\n"
    "      st.isDirectory     = function () { return d; };\n"
    "      st.isSymbolicLink  = function () { return l; };\n"
    "      return st;\n"
    "    };\n"
    "  }\n"
    "  var fs = {\n"
    "    readFileSync:   nativeFs.readFileSync,\n"
    "    writeFileSync:  nativeFs.writeFileSync,\n"
    "    existsSync:     nativeFs.existsSync,\n"
    "    readdirSync:    nativeFs.readdirSync,\n"
    "    statSync:       _wrapStats(nativeFs.statSync),\n"
    "    lstatSync:      _wrapStats(nativeFs.statSync),\n"
    "    unlinkSync:     nativeFs.unlinkSync,\n"
    "    mkdirSync:      nativeFs.mkdirSync,\n"
    "    rmdirSync:      nativeFs.rmdirSync,\n"
    "    renameSync:     nativeFs.renameSync,\n"
    "    appendFileSync: nativeFs.appendFileSync,\n"
    "    copyFileSync:   nativeFs.copyFileSync,\n"
    "    chmodSync:      nativeFs.chmodSync\n"
    "  };\n"

    // --- path (public shape wrapping __path_native__) ---
    "  var path = {\n"
    "    join: __path_native__.join,\n"
    "    dirname: __path_native__.dirname,\n"
    "    basename: __path_native__.basename,\n"
    "    extname: __path_native__.extname,\n"
    "    resolve: __path_native__.resolve,\n"
    "    isAbsolute: __path_native__.isAbsolute,\n"
    "    sep: __path_native__.sep\n"
    "  };\n"

    // --- events.EventEmitter (pure JS, Node-compatible enough for most libs).
    // _events is lazily initialized on first listener so that subclasses
    // whose constructors skip calling EventEmitter.call(this) still work
    // (commander's Command is one example).
    "  function EventEmitter() { this._events = Object.create(null); this._maxListeners = 10; }\n"
    "  function _evs(self) { if (!self._events) self._events = Object.create(null); return self._events; }\n"
    "  EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (ev, fn) {\n"
    "    var m = _evs(this); (m[ev] || (m[ev] = [])).push(fn);\n"
    "    return this;\n"
    "  };\n"
    "  EventEmitter.prototype.once = function (ev, fn) {\n"
    "    var self = this;\n"
    "    function wrap() { self.removeListener(ev, wrap); fn.apply(self, arguments); }\n"
    "    wrap._orig = fn;\n"
    "    return this.on(ev, wrap);\n"
    "  };\n"
    "  EventEmitter.prototype.removeListener = function (ev, fn) {\n"
    "    var arr = _evs(this)[ev]; if (!arr) return this;\n"
    "    for (var i = 0; i < arr.length; ++i) if (arr[i] === fn || arr[i]._orig === fn) { arr.splice(i, 1); break; }\n"
    "    return this;\n"
    "  };\n"
    "  EventEmitter.prototype.removeAllListeners = function (ev) {\n"
    "    if (ev === undefined) this._events = Object.create(null);\n"
    "    else { var m = _evs(this); delete m[ev]; }\n"
    "    return this;\n"
    "  };\n"
    "  EventEmitter.prototype.listeners = function (ev) { return (_evs(this)[ev] || []).slice(); };\n"
    "  EventEmitter.prototype.listenerCount = function (ev) { return (_evs(this)[ev] || []).length; };\n"
    "  EventEmitter.prototype.emit = function (ev) {\n"
    "    var arr = _evs(this)[ev]; if (!arr) return false;\n"
    "    var args = Array.prototype.slice.call(arguments, 1);\n"
    "    var copy = arr.slice();\n"
    "    for (var i = 0; i < copy.length; ++i) copy[i].apply(this, args);\n"
    "    return true;\n"
    "  };\n"
    "  EventEmitter.prototype.setMaxListeners = function (n) { this._maxListeners = n; return this; };\n"
    "  EventEmitter.prototype.getMaxListeners = function () { return this._maxListeners; };\n"
    // Node-compat: require('events') IS the EventEmitter constructor
    // itself (with a .EventEmitter property pointing back to itself for
    // destructuring consumers). Libraries like xml2js do
    //   events = require('events');
    //   (function(superClass) { ... })(events);     <-- uses the module
    // and expect `events` to behave like the EventEmitter class directly.
    // A wrapper object (`{ EventEmitter: fn }`) breaks that path.
    "  var events = EventEmitter;\n"
    "  events.EventEmitter = EventEmitter;\n"

    // --- util (inherits, format, inspect, inspect, promisify, deprecate) ---
    "  var util = {};\n"
    "  util.inherits = function (ctor, superCtor) {\n"
    "    if (!ctor || !superCtor) throw new TypeError('util.inherits: both args required');\n"
    "    ctor.super_ = superCtor;\n"
    "    ctor.prototype = Object.create(superCtor.prototype, { constructor: { value: ctor, enumerable: false, writable: true, configurable: true } });\n"
    "  };\n"
    "  util.format = function (fmt) {\n"
    "    if (typeof fmt !== 'string') {\n"
    "      var parts = [];\n"
    "      for (var i = 0; i < arguments.length; ++i) parts.push(util.inspect(arguments[i]));\n"
    "      return parts.join(' ');\n"
    "    }\n"
    "    var i = 1, args = arguments, len = args.length;\n"
    "    var out = fmt.replace(/%[sdifjoO%]/g, function (spec) {\n"
    "      if (spec === '%%') return '%';\n"
    "      if (i >= len) return spec;\n"
    "      var a = args[i++];\n"
    "      switch (spec) {\n"
    "        case '%s': return String(a);\n"
    "        case '%d': case '%i': return Number(a).toString();\n"
    "        case '%f': return parseFloat(a).toString();\n"
    "        case '%j': try { return JSON.stringify(a); } catch (e) { return '[Circular]'; }\n"
    "        case '%o': case '%O': return util.inspect(a);\n"
    "        default: return spec;\n"
    "      }\n"
    "    });\n"
    "    while (i < len) out += ' ' + util.inspect(args[i++]);\n"
    "    return out;\n"
    "  };\n"
    // util.inspect: depth-limited (default 2), cycle-safe, aware of Date,
    // RegExp, Error, Map, Set, Uint8Array. String is single-quoted with
    // backslash/newline escapes. Object prefix shows a non-'Object'
    // constructor name when present.
    "  function _inspectString(s) {\n"
    "    return \"'\" + s.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\")\n"
    "                    .replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r')\n"
    "                    .replace(/\\t/g, '\\\\t') + \"'\";\n"
    "  }\n"
    "  function _inspect(v, depth, seen) {\n"
    "    if (v === null) return 'null';\n"
    "    if (v === undefined) return 'undefined';\n"
    "    var t = typeof v;\n"
    "    if (t === 'string') return _inspectString(v);\n"
    "    if (t === 'number' || t === 'boolean') return String(v);\n"
    "    if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : '') + ']';\n"
    "    if (t === 'symbol') return String(v);\n"
    "    if (t !== 'object') return String(v);\n"
    "    if (seen.indexOf(v) >= 0) return '[Circular]';\n"
    "    if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();\n"
    "    if (v instanceof RegExp) return v.toString();\n"
    "    if (v instanceof Error) {\n"
    "      var out = (v.name || 'Error') + ': ' + (v.message || '');\n"
    "      if (v.stack) {\n"
    "        var lines = String(v.stack).split('\\n').slice(0, 3);\n"
    "        for (var i = 0; i < lines.length; ++i)\n"
    "          out += '\\n    at ' + lines[i].replace(/^\\s+at\\s+/, '').replace(/^\\s+/, '');\n"
    "      }\n"
    "      return out;\n"
    "    }\n"
    "    if (depth < 0) return Array.isArray(v) ? '[Array]' :\n"
    "                          (v.constructor && v.constructor.name ? '[' + v.constructor.name + ']' : '[Object]');\n"
    "    seen.push(v);\n"
    "    var result;\n"
    "    try {\n"
    "      if (Array.isArray(v)) {\n"
    "        if (v.length === 0) { result = '[]'; }\n"
    "        else {\n"
    "          var parts = [];\n"
    "          var limit = Math.min(v.length, 100);\n"
    "          for (var i = 0; i < limit; ++i) parts.push(_inspect(v[i], depth - 1, seen));\n"
    "          if (v.length > limit) parts.push('... ' + (v.length - limit) + ' more');\n"
    "          result = '[ ' + parts.join(', ') + ' ]';\n"
    "        }\n"
    "      } else if (typeof Map !== 'undefined' && v instanceof Map) {\n"
    "        var mp = [], mn = 0;\n"
    "        v.forEach(function (val, key) {\n"
    "          if (mn++ < 20) mp.push(_inspect(key, depth - 1, seen) + ' => ' + _inspect(val, depth - 1, seen));\n"
    "        });\n"
    "        if (mn > 20) mp.push('... ' + (mn - 20) + ' more');\n"
    "        result = 'Map(' + v.size + ') { ' + mp.join(', ') + ' }';\n"
    "      } else if (typeof Set !== 'undefined' && v instanceof Set) {\n"
    "        var sp = [], sn = 0;\n"
    "        v.forEach(function (val) {\n"
    "          if (sn++ < 20) sp.push(_inspect(val, depth - 1, seen));\n"
    "        });\n"
    "        if (sn > 20) sp.push('... ' + (sn - 20) + ' more');\n"
    "        result = 'Set(' + v.size + ') { ' + sp.join(', ') + ' }';\n"
    "      } else if (typeof Uint8Array !== 'undefined' && v instanceof Uint8Array) {\n"
    "        var preview = Array.prototype.slice.call(v, 0, 16);\n"
    "        result = 'Uint8Array(' + v.length + ') [ ' + preview.join(', ') +\n"
    "                 (v.length > 16 ? ', ... ' + (v.length - 16) + ' more' : '') + ' ]';\n"
    "      } else {\n"
    "        var keys;\n"
    "        try { keys = Object.keys(v); } catch (e) { keys = []; }\n"
    "        if (keys.length === 0) { result = '{}'; }\n"
    "        else {\n"
    "          var kp = [];\n"
    "          for (var j = 0; j < keys.length; ++j)\n"
    "            kp.push(keys[j] + ': ' + _inspect(v[keys[j]], depth - 1, seen));\n"
    "          var ctor = (v.constructor && v.constructor.name) || '';\n"
    "          var prefix = ctor && ctor !== 'Object' ? ctor + ' ' : '';\n"
    "          result = prefix + '{ ' + kp.join(', ') + ' }';\n"
    "        }\n"
    "      }\n"
    "    } catch (e) {\n"
    "      result = '[' + (v.constructor && v.constructor.name || 'Object') + ']';\n"
    "    }\n"
    "    seen.pop();\n"
    "    return result;\n"
    "  }\n"
    "  util.inspect = function (v, opts) {\n"
    "    var depth = 2;\n"
    "    if (typeof opts === 'object' && opts !== null &&\n"
    "        typeof opts.depth === 'number') depth = opts.depth;\n"
    "    return _inspect(v, depth, []);\n"
    "  };\n"
    "  util.promisify = function (fn) {\n"
    "    throw new Error('util.promisify: no Promise/event-loop support on ionpower-node');\n"
    "  };\n"
    "  util.deprecate = function (fn, msg) {\n"
    "    var warned = false;\n"
    "    return function () {\n"
    "      if (!warned) { warned = true; console.warn('(DEP) ' + msg); }\n"
    "      return fn.apply(this, arguments);\n"
    "    };\n"
    "  };\n"
    "  util.types = { isDate: function (v) { return v instanceof Date; } };\n"

    // --- child_process (stub that throws on actual exec) ---
    "  function _cpUnsupported(name) {\n"
    "    throw new Error('child_process.' + name + ' is not supported on ionpower-node');\n"
    "  }\n"
    "  var child_process = {\n"
    "    spawn:    function () { _cpUnsupported('spawn'); },\n"
    "    exec:     function () { _cpUnsupported('exec'); },\n"
    "    execSync: function () { _cpUnsupported('execSync'); },\n"
    "    fork:     function () { _cpUnsupported('fork'); }\n"
    "  };\n"

    // --- os (minimal stub) ---
    "  var os = {\n"
    "    platform: function () { return 'darwin'; },\n"
    "    arch:     function () { return 'ppc'; },\n"
    "    tmpdir:   function () { return '/tmp'; },\n"
    "    homedir:  function () { return process.env.HOME || '/Users/macuser'; },\n"
    "    EOL:      '\\n',\n"
    "    cpus:     function () { return [{ model: 'PowerPC', speed: 0, times: {} }]; },\n"
    "    hostname: function () { return process.env.HOSTNAME || 'localhost'; }\n"
    "  };\n"

    // --- crypto (randomBytes + web-style getRandomValues + hash/hmac) ---
    // SHA-256 + HMAC inlined from RFC 6234 reference, patched for 32-bit JS
    // arithmetic. Produces byte arrays. createHash/createHmac return objects
    // with .update(data).digest(enc) — the subset Node consumers expect.
    // Supports `sha256` only for the hash; other algorithms throw.
    "  function _sha256_bytes(bytes) {\n"
    "    var K = [\n"
    "      0x428a2f98|0,0x71374491|0,0xb5c0fbcf|0,0xe9b5dba5|0,0x3956c25b|0,0x59f111f1|0,0x923f82a4|0,0xab1c5ed5|0,\n"
    "      0xd807aa98|0,0x12835b01|0,0x243185be|0,0x550c7dc3|0,0x72be5d74|0,0x80deb1fe|0,0x9bdc06a7|0,0xc19bf174|0,\n"
    "      0xe49b69c1|0,0xefbe4786|0,0x0fc19dc6|0,0x240ca1cc|0,0x2de92c6f|0,0x4a7484aa|0,0x5cb0a9dc|0,0x76f988da|0,\n"
    "      0x983e5152|0,0xa831c66d|0,0xb00327c8|0,0xbf597fc7|0,0xc6e00bf3|0,0xd5a79147|0,0x06ca6351|0,0x14292967|0,\n"
    "      0x27b70a85|0,0x2e1b2138|0,0x4d2c6dfc|0,0x53380d13|0,0x650a7354|0,0x766a0abb|0,0x81c2c92e|0,0x92722c85|0,\n"
    "      0xa2bfe8a1|0,0xa81a664b|0,0xc24b8b70|0,0xc76c51a3|0,0xd192e819|0,0xd6990624|0,0xf40e3585|0,0x106aa070|0,\n"
    "      0x19a4c116|0,0x1e376c08|0,0x2748774c|0,0x34b0bcb5|0,0x391c0cb3|0,0x4ed8aa4a|0,0x5b9cca4f|0,0x682e6ff3|0,\n"
    "      0x748f82ee|0,0x78a5636f|0,0x84c87814|0,0x8cc70208|0,0x90befffa|0,0xa4506ceb|0,0xbef9a3f7|0,0xc67178f2|0\n"
    "    ];\n"
    "    var H = [0x6a09e667|0,0xbb67ae85|0,0x3c6ef372|0,0xa54ff53a|0,\n"
    "             0x510e527f|0,0x9b05688c|0,0x1f83d9ab|0,0x5be0cd19|0];\n"
    "    var bitLen = bytes.length * 8;\n"
    "    var padLen = (bytes.length + 9 + 63) & ~63;\n"
    "    var padded = new Uint8Array(padLen);\n"
    "    for (var i = 0; i < bytes.length; ++i) padded[i] = bytes[i];\n"
    "    padded[bytes.length] = 0x80;\n"
    "    padded[padLen - 4] = (bitLen >>> 24) & 0xFF;\n"
    "    padded[padLen - 3] = (bitLen >>> 16) & 0xFF;\n"
    "    padded[padLen - 2] = (bitLen >>>  8) & 0xFF;\n"
    "    padded[padLen - 1] =  bitLen         & 0xFF;\n"
    "    function ror(x, n) { return (x >>> n) | (x << (32 - n)); }\n"
    "    for (var off = 0; off < padLen; off += 64) {\n"
    "      var W = new Array(64);\n"
    "      for (var t = 0; t < 16; ++t) {\n"
    "        W[t] = ((padded[off + t*4] << 24) |\n"
    "                (padded[off + t*4 + 1] << 16) |\n"
    "                (padded[off + t*4 + 2] << 8) |\n"
    "                padded[off + t*4 + 3]) | 0;\n"
    "      }\n"
    "      for (var t2 = 16; t2 < 64; ++t2) {\n"
    "        var s0 = ror(W[t2-15], 7) ^ ror(W[t2-15], 18) ^ (W[t2-15] >>> 3);\n"
    "        var s1 = ror(W[t2-2], 17) ^ ror(W[t2-2], 19)  ^ (W[t2-2] >>> 10);\n"
    "        W[t2] = (W[t2-16] + s0 + W[t2-7] + s1) | 0;\n"
    "      }\n"
    "      var a = H[0], b = H[1], c = H[2], d = H[3],\n"
    "          e = H[4], f = H[5], g = H[6], h = H[7];\n"
    "      for (var t3 = 0; t3 < 64; ++t3) {\n"
    "        var S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);\n"
    "        var ch = (e & f) ^ (~e & g);\n"
    "        var temp1 = (h + S1 + ch + K[t3] + W[t3]) | 0;\n"
    "        var S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);\n"
    "        var mj = (a & b) ^ (a & c) ^ (b & c);\n"
    "        var temp2 = (S0 + mj) | 0;\n"
    "        h = g; g = f; f = e; e = (d + temp1) | 0;\n"
    "        d = c; c = b; b = a; a = (temp1 + temp2) | 0;\n"
    "      }\n"
    "      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;\n"
    "      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;\n"
    "      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;\n"
    "      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;\n"
    "    }\n"
    "    var out = new Uint8Array(32);\n"
    "    for (var k2 = 0; k2 < 8; ++k2) {\n"
    "      out[k2*4]   = (H[k2] >>> 24) & 0xFF;\n"
    "      out[k2*4+1] = (H[k2] >>> 16) & 0xFF;\n"
    "      out[k2*4+2] = (H[k2] >>>  8) & 0xFF;\n"
    "      out[k2*4+3] =  H[k2]         & 0xFF;\n"
    "    }\n"
    "    return out;\n"
    "  }\n"
    "  function _coerceBytes(x, enc) {\n"
    "    if (x == null) return new Uint8Array(0);\n"
    "    if (x instanceof Uint8Array) return x;\n"
    "    if (x && x._rawKey instanceof Uint8Array) return x._rawKey;\n" // KeyObject
    "    if (typeof x === 'string') return Buffer.from(x, enc || 'utf8');\n"
    "    if (typeof x.length === 'number') return new Uint8Array(x);\n"
    "    throw new TypeError('crypto: expected string or Buffer');\n"
    "  }\n"
    "  function _hmacSha256(key, data) {\n"
    "    var blockSize = 64;\n"
    "    var k = _coerceBytes(key);\n"
    "    if (k.length > blockSize) k = _sha256_bytes(k);\n"
    "    var k0 = new Uint8Array(blockSize);\n"
    "    for (var i = 0; i < k.length; ++i) k0[i] = k[i];\n"
    "    var ipad = new Uint8Array(blockSize);\n"
    "    var opad = new Uint8Array(blockSize);\n"
    "    for (var j = 0; j < blockSize; ++j) {\n"
    "      ipad[j] = k0[j] ^ 0x36;\n"
    "      opad[j] = k0[j] ^ 0x5c;\n"
    "    }\n"
    "    var inner = new Uint8Array(blockSize + data.length);\n"
    "    inner.set(ipad, 0);\n"
    "    inner.set(data, blockSize);\n"
    "    var innerHash = _sha256_bytes(inner);\n"
    "    var outer = new Uint8Array(blockSize + innerHash.length);\n"
    "    outer.set(opad, 0);\n"
    "    outer.set(innerHash, blockSize);\n"
    "    return _sha256_bytes(outer);\n"
    "  }\n"
    "  function _digestOut(bytes, enc) {\n"
    "    if (!enc || enc === 'buffer') return bytes;\n"
    "    return bytes.toString(enc);\n"
    "  }\n"
    "  function Hash(alg) {\n"
    "    if (alg !== 'sha256' && alg !== 'SHA256' && alg !== 'sha-256')\n"
    "      throw new Error('crypto: algorithm ' + alg + ' not supported (ionpower-node only has sha256 inline)');\n"
    "    this._chunks = [];\n"
    "  }\n"
    "  Hash.prototype.update = function (data, enc) {\n"
    "    this._chunks.push(_coerceBytes(data, enc));\n"
    "    return this;\n"
    "  };\n"
    "  Hash.prototype.digest = function (enc) {\n"
    "    var total = 0;\n"
    "    for (var i = 0; i < this._chunks.length; ++i) total += this._chunks[i].length;\n"
    "    var buf = new Uint8Array(total);\n"
    "    var off = 0;\n"
    "    for (var j = 0; j < this._chunks.length; ++j) {\n"
    "      buf.set(this._chunks[j], off);\n"
    "      off += this._chunks[j].length;\n"
    "    }\n"
    "    return _digestOut(_sha256_bytes(buf), enc);\n"
    "  };\n"
    "  function Hmac(alg, key) {\n"
    "    if (alg !== 'sha256' && alg !== 'SHA256' && alg !== 'sha-256')\n"
    "      throw new Error('crypto.createHmac: algorithm ' + alg + ' not supported');\n"
    "    this._key = _coerceBytes(key);\n"
    "    this._chunks = [];\n"
    "  }\n"
    "  Hmac.prototype.update = function (data, enc) {\n"
    "    this._chunks.push(_coerceBytes(data, enc));\n"
    "    return this;\n"
    "  };\n"
    "  Hmac.prototype.digest = function (enc) {\n"
    "    var total = 0;\n"
    "    for (var i = 0; i < this._chunks.length; ++i) total += this._chunks[i].length;\n"
    "    var buf = new Uint8Array(total);\n"
    "    var off = 0;\n"
    "    for (var j = 0; j < this._chunks.length; ++j) {\n"
    "      buf.set(this._chunks[j], off);\n"
    "      off += this._chunks[j].length;\n"
    "    }\n"
    "    return _digestOut(_hmacSha256(this._key, buf), enc);\n"
    "  };\n"

    // KeyObject: jsonwebtoken gates sign/verify on `x instanceof KeyObject`
    // (and `key.type === 'secret'`). We return proper KeyObject instances
    // from createSecretKey with ._rawKey holding the bytes; _coerceBytes
    // unwraps them at hash/hmac time. jwa's KeyObject branches remain
    // inactive because we don't define createPublicKey.
    "  function KeyObject() { this.type = 'secret'; }\n"
    "  KeyObject.prototype.export = function () { return this._rawKey; };\n"
    "  function createSecretKey(keyish, enc) {\n"
    "    if (keyish == null) throw new TypeError('createSecretKey: key required');\n"
    "    var k = new KeyObject();\n"
    "    if (keyish instanceof Uint8Array) { k._rawKey = keyish; return k; }\n"
    "    if (typeof keyish === 'string') { k._rawKey = Buffer.from(keyish, enc || 'utf8'); return k; }\n"
    "    throw new TypeError('createSecretKey: unsupported key type');\n"
    "  }\n"
    "  function createPrivateKey() {\n"
    "    throw new Error('crypto.createPrivateKey: asymmetric keys not supported on ionpower-node (HMAC only)');\n"
    "  }\n"
    // jwa detects KeyObject support via `typeof crypto.createPublicKey`; we
    // *must* expose something callable so jwa's symmetric-key code accepts
    // our KeyObject wrappers. Always throws when actually called.
    "  function createPublicKey() {\n"
    "    throw new Error('crypto.createPublicKey: asymmetric keys not supported on ionpower-node (HMAC only)');\n"
    "  }\n"

    "  var nativeCrypto = __crypto_native__;\n"
    "  var crypto = {\n"
    "    randomBytes:     nativeCrypto.randomBytes,\n"
    "    getRandomValues: nativeCrypto.getRandomValues,\n"
    "    randomFillSync:  function (buf) { nativeCrypto.getRandomValues(buf); return buf; },\n"
    "    createHash:      function (alg) { return new Hash(alg); },\n"
    "    createHmac:      function (alg, key) { return new Hmac(alg, key); },\n"
    "    createSecretKey: createSecretKey,\n"
    "    createPrivateKey: createPrivateKey,\n"
    "    createPublicKey:  createPublicKey,\n"
    "    KeyObject:       KeyObject,\n"
    "    timingSafeEqual: function (a, b) {\n"
    "      if (a.length !== b.length) return false;\n"
    "      var r = 0;\n"
    "      for (var i = 0; i < a.length; ++i) r |= (a[i] ^ b[i]);\n"
    "      return r === 0;\n"
    "    }\n"
    "  };\n"
    // Web Crypto lives on globalThis.crypto in browsers and Node 20+.
    "  if (typeof globalThis !== 'undefined') { globalThis.crypto = crypto; }\n"
    "  this.crypto = crypto;\n"   // also pin on global in case globalThis missing

    // --- buffer (reexport the Buffer global as a core module) ---
    "  var buffer = { Buffer: Buffer, constants: {}, kMaxLength: 0x7fffffff };\n"

    // Browser UMD bundles often reach for `self` as the global object.
    // Make it resolve to our global so those bundles don't ReferenceError.
    "  if (typeof self === 'undefined') {\n"
    "    if (typeof globalThis !== 'undefined') globalThis.self = globalThis;\n"
    "    else this.self = this;\n"
    "  }\n"

    // TextEncoder / TextDecoder: Web-standard string <-> UTF-8 Uint8Array.
    // Several libraries (murmurhash, modern base64 wrappers) reach for
    // these. We implement them on top of Buffer.from / Uint8Array.toString.
    "  if (typeof TextEncoder === 'undefined') {\n"
    "    function TextEncoder() { this.encoding = 'utf-8'; }\n"
    "    TextEncoder.prototype.encode = function (str) {\n"
    "      return Buffer.from(String(str || ''), 'utf8');\n"
    "    };\n"
    "    this.TextEncoder = TextEncoder;\n"
    "    if (typeof globalThis !== 'undefined') globalThis.TextEncoder = TextEncoder;\n"
    "  }\n"
    "  if (typeof TextDecoder === 'undefined') {\n"
    "    function TextDecoder(enc) {\n"
    "      this.encoding = (enc || 'utf-8').toLowerCase();\n"
    "    }\n"
    "    TextDecoder.prototype.decode = function (u8) {\n"
    "      if (!u8) return '';\n"
    "      if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);\n"
    "      return u8.toString(this.encoding === 'utf-8' ? 'utf8' : this.encoding);\n"
    "    };\n"
    "    this.TextDecoder = TextDecoder;\n"
    "    if (typeof globalThis !== 'undefined') globalThis.TextDecoder = TextDecoder;\n"
    "  }\n"

    // --- string_decoder — minimal, no partial-sequence buffering ---
    "  function StringDecoder(encoding) { this.encoding = encoding || 'utf8'; }\n"
    "  StringDecoder.prototype.write = function (buf) {\n"
    "    if (!buf) return '';\n"
    "    if (typeof buf === 'string') return buf;\n"
    "    // Uint8Array path: decode using Buffer.toString if enc is utf8,\n"
    "    // else latin1.\n"
    "    if (typeof buf.toString === 'function') return buf.toString(this.encoding);\n"
    "    return '';\n"
    "  };\n"
    "  StringDecoder.prototype.end = function () { return ''; };\n"
    "  var string_decoder = { StringDecoder: StringDecoder };\n"

    // --- assert (node:assert) — minimal throwing assertions ---
    "  function AssertionError(msg) {\n"
    "    this.name = 'AssertionError'; this.message = msg || '';\n"
    "  }\n"
    "  AssertionError.prototype = Object.create(Error.prototype);\n"
    "  AssertionError.prototype.constructor = AssertionError;\n"
    "  function _assert(cond, msg) { if (!cond) throw new AssertionError(msg || 'assert failed'); }\n"
    "  _assert.ok               = _assert;\n"
    "  _assert.equal            = function (a, b, m) { if (a != b) throw new AssertionError(m || (a + ' != ' + b)); };\n"
    "  _assert.strictEqual      = function (a, b, m) { if (a !== b) throw new AssertionError(m || (a + ' !== ' + b)); };\n"
    "  _assert.notEqual         = function (a, b, m) { if (a == b) throw new AssertionError(m || (a + ' == ' + b)); };\n"
    "  _assert.notStrictEqual   = function (a, b, m) { if (a === b) throw new AssertionError(m || (a + ' === ' + b)); };\n"
    "  _assert.deepEqual        = function (a, b, m) { if (JSON.stringify(a) != JSON.stringify(b)) throw new AssertionError(m || 'deepEqual failed'); };\n"
    "  _assert.deepStrictEqual  = _assert.deepEqual;\n"
    "  _assert.throws           = function (fn, m) { var t = null; try { fn(); } catch (e) { t = e; } if (!t) throw new AssertionError(m || 'did not throw'); };\n"
    "  _assert.doesNotThrow     = function (fn, m) { try { fn(); } catch (e) { throw new AssertionError(m || ('threw: ' + e)); } };\n"
    "  _assert.fail             = function (m) { throw new AssertionError(m || 'fail'); };\n"
    "  _assert.AssertionError   = AssertionError;\n"

    // --- stream (pass-through stub). Node's require('stream') returns the
    // Stream constructor *itself* (with Readable/Writable/etc as properties),
    // not a wrapper object. Libraries do `util.inherits(X, Stream)` — that
    // only works if Stream is a function with a .prototype.
    "  function _StreamStub(name) { events.EventEmitter.call(this); this._name = name; }\n"
    "  util.inherits(_StreamStub, events.EventEmitter);\n"
    "  _StreamStub.prototype.pipe    = function (d) { return d; };\n"
    "  _StreamStub.prototype.write   = function () { return true; };\n"
    "  _StreamStub.prototype.end     = function () { return this; };\n"
    "  var stream = _StreamStub;\n"
    "  stream.Readable  = _StreamStub;\n"
    "  stream.Writable  = _StreamStub;\n"
    "  stream.Duplex    = _StreamStub;\n"
    "  stream.Transform = _StreamStub;\n"
    "  stream.Stream    = _StreamStub;\n"
    "  stream.PassThrough = _StreamStub;\n"

    // --- Seed core modules into require cache. ---
    "  __require_cache__['fs']            = fs;\n"
    "  __require_cache__['path']          = path;\n"
    "  __require_cache__['events']        = events;\n"
    "  __require_cache__['util']          = util;\n"
    "  __require_cache__['child_process'] = child_process;\n"
    "  __require_cache__['os']            = os;\n"
    "  __require_cache__['crypto']        = crypto;\n"
    "  __require_cache__['buffer']         = buffer;\n"
    "  __require_cache__['string_decoder'] = string_decoder;\n"
    "  __require_cache__['assert']         = _assert;\n"
    "  __require_cache__['stream']         = stream;\n"
    "  __require_cache__['timers']         = {\n"
    "    setImmediate:   (typeof setImmediate === 'function') ? setImmediate : null,\n"
    "    clearImmediate: (typeof clearImmediate === 'function') ? clearImmediate : function(){},\n"
    "    setTimeout:     (typeof setTimeout === 'function') ? setTimeout : null,\n"
    "    clearTimeout:   (typeof clearTimeout === 'function') ? clearTimeout : function(){},\n"
    "    setInterval:    (typeof setInterval === 'function') ? setInterval : null,\n"
    "    clearInterval:  (typeof clearInterval === 'function') ? clearInterval : function(){}\n"
    "  };\n"
    // Minimal querystring: supports key=value pairs with URL-decoding.
    "  __require_cache__['querystring']    = {\n"
    "    parse: function (str) {\n"
    "      var out = {};\n"
    "      if (!str) return out;\n"
    "      var pairs = str.split('&');\n"
    "      for (var i = 0; i < pairs.length; ++i) {\n"
    "        var eq = pairs[i].indexOf('=');\n"
    "        var k = decodeURIComponent(eq < 0 ? pairs[i] : pairs[i].slice(0, eq));\n"
    "        var v = eq < 0 ? '' : decodeURIComponent(pairs[i].slice(eq + 1));\n"
    "        out[k] = v;\n"
    "      }\n"
    "      return out;\n"
    "    },\n"
    "    stringify: function (obj) {\n"
    "      var parts = [];\n"
    "      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {\n"
    "        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));\n"
    "      }\n"
    "      return parts.join('&');\n"
    "    }\n"
    "  };\n"
    // URL: extremely lax parse, just enough for import-metadata-style consumers.
    "  __require_cache__['url']            = {\n"
    "    parse:  function (s) { return { href: s, pathname: s }; },\n"
    "    format: function (u) { return u.href || String(u); }\n"
    "  };\n"
    // http: blocking HTTP client via curl shell-out. Caveat emptor — not a
    // real server/event-loop shape; getSync/postSync return the full
    // response synchronously. Node's http.createServer / http.request are
    // NOT implemented.
    "  var _nativeHttp = __http_native__;\n"
    "  var http = {\n"
    "    getSync:  _nativeHttp.getSync,\n"
    "    postSync: _nativeHttp.postSync,\n"
    // Node-compat convenience: http.get(url, cb) => calls cb(res) synchronously
    // with a response-shaped object. Real Node uses streams; we don't.
    "    get: function (url, cb) { var r = _nativeHttp.getSync(url); if (cb) cb(r); return r; },\n"
    "    request: function () { throw new Error('http.request: no event loop on ionpower-node; use http.getSync/postSync'); },\n"
    "    createServer: function () { throw new Error('http.createServer: not supported'); }\n"
    "  };\n"
    "  __require_cache__['http']          = http;\n"
    "  __require_cache__['https']         = http;\n"  // same impl (curl handles both)
    // net: EventEmitter-shaped Socket stub. Throws on actual connect.
    "  function _Socket() { events.EventEmitter.call(this); }\n"
    "  util.inherits(_Socket, events.EventEmitter);\n"
    "  _Socket.prototype.connect = function () { throw new Error('net.Socket.connect: no event loop on ionpower-node'); };\n"
    "  _Socket.prototype.write   = function () { return false; };\n"
    "  __require_cache__['net']            = { Socket: _Socket, createServer: function () { throw new Error('net.createServer: not supported'); } };\n"
    // tty: isatty backed by our process.std*.isTTY; Stream stubs for
    // consumers that `new tty.WriteStream(fd)` (we only support
    // EventEmitter-shape listening, not actual reads/writes).
    "  __require_cache__['tty']            = {\n"
    "    isatty: function (fd) {\n"
    "      if (fd === 1 && process.stdout) return !!process.stdout.isTTY;\n"
    "      if (fd === 2 && process.stderr) return !!process.stderr.isTTY;\n"
    "      return false;\n"
    "    },\n"
    "    ReadStream:  function () { events.EventEmitter.call(this); },\n"
    "    WriteStream: function () { events.EventEmitter.call(this); }\n"
    "  };\n"
    "  util.inherits(__require_cache__['tty'].ReadStream,  events.EventEmitter);\n"
    "  util.inherits(__require_cache__['tty'].WriteStream, events.EventEmitter);\n"

    // Re-wrap __make_require__ so bare specifiers check the cache first,
    // and strip the `node:` prefix (Node ≥16 supports `require('node:path')`;
    // some modern libs reach for it explicitly).
    "  var origMake = __make_require__;\n"
    "  __make_require__ = function(dir) {\n"
    "    var req = origMake(dir);\n"
    "    return function(spec) {\n"
    "      if (typeof spec === 'string' && spec.indexOf('node:') === 0)\n"
    "        spec = spec.slice(5);\n"
    "      if (__require_cache__.hasOwnProperty(spec)) return __require_cache__[spec];\n"
    "      return req(spec);\n"
    "    };\n"
    "  };\n"

    // --- Babel fallback for modern syntax (transpile-on-require).
    // Triggered by require.cpp when JS::Evaluate fails: we pass the raw
    // pre-wrap source + mtime here, try to lazy-load @babel/standalone, and
    // return the transpiled ES5 source as a string (or null on failure /
    // opt-out). require.cpp then re-wraps and re-evaluates.
    "  this.__babel_instance__ = null;\n"
    "  this.__babel_attempted__ = false;\n"
    "  this.__babel_mem_cache__ = {};\n"  // abs_path -> { mtime, code }
    "  this.__babel_disk_dir__ = (process.env.HOME || '/tmp') + '/.ionpower-cache/babel-v1';\n"
    "  function __babel_flat_key__(p) {\n"
    "    return p.replace(/[^A-Za-z0-9_.-]/g, function (c) {\n"
    "      return '_' + c.charCodeAt(0).toString(16) + '_';\n"
    "    });\n"
    "  }\n"
    "  function __babel_lazy_load__() {\n"
    "    if (__babel_instance__) return __babel_instance__;\n"
    "    if (__babel_attempted__) return null;\n"
    "    __babel_attempted__ = true;\n"
    "    var cwd = process.cwd();\n"
    "    var candidates = [];\n"
    "    if (process.env.IONPOWER_BABEL_PATH) candidates.push(process.env.IONPOWER_BABEL_PATH);\n"
    "    candidates.push(cwd + '/test/vendor/babel.js');\n"
    "    candidates.push(cwd + '/vendor/babel.js');\n"
    "    candidates.push(cwd + '/node_modules/@babel/standalone/babel.js');\n"
    "    for (var i = 0; i < candidates.length; ++i) {\n"
    "      try {\n"
    "        if (!fs.existsSync(candidates[i])) continue;\n"
    "        __babel_instance__ = __require_native__('/', candidates[i]);\n"
    "        if (__babel_instance__) return __babel_instance__;\n"
    "      } catch (e) { /* try next */ }\n"
    "    }\n"
    "    return null;\n"
    "  }\n"
    "  this.__try_babel_transpile__ = function (absPath, rawSrc, mtime) {\n"
    "    if (process.env.IONPOWER_NO_BABEL === '1') return null;\n"
    "    var hit = __babel_mem_cache__[absPath];\n"
    "    if (hit && hit.mtime === mtime) return hit.code;\n"
    // Disk cache read.
    "    var key = __babel_flat_key__(absPath);\n"
    "    var diskPath = __babel_disk_dir__ + '/' + key + '.js';\n"
    "    if (fs.existsSync(diskPath)) {\n"
    "      try {\n"
    "        var blob = fs.readFileSync(diskPath, 'utf8');\n"
    "        var firstNL = blob.indexOf('\\n');\n"
    "        if (firstNL > 0) {\n"
    "          var header = blob.slice(0, firstNL);\n"
    "          var m = /^\\/\\/ ionpower-babel-v1 mtime=(\\d+)/.exec(header);\n"
    "          if (m && Number(m[1]) === mtime) {\n"
    "            var body = blob.slice(firstNL + 1);\n"
    "            __babel_mem_cache__[absPath] = { mtime: mtime, code: body };\n"
    "            return body;\n"
    "          }\n"
    "        }\n"
    "      } catch (e) { /* stale cache — fall through to rebuild */ }\n"
    "    }\n"
    "    var babel = __babel_lazy_load__();\n"
    "    if (!babel) return null;\n"
    "    var code;\n"
    "    try {\n"
    "      code = babel.transform(rawSrc, { presets: ['env'] }).code;\n"
    "    } catch (e) { return null; }\n"
    "    __babel_mem_cache__[absPath] = { mtime: mtime, code: code };\n"
    // Disk cache write (best-effort).
    "    try {\n"
    "      fs.mkdirSync(__babel_disk_dir__, { recursive: true });\n"
    "      fs.writeFileSync(diskPath,\n"
    "        '// ionpower-babel-v1 mtime=' + mtime + '\\n' + code);\n"
    "    } catch (e) { /* disk cache optional */ }\n"
    "    return code;\n"
    "  };\n"
    "})();\n";

bool InstallNodeCompatGlobals(JSContext* cx, JS::HandleObject global,
                              int argc, char** argv)
{
    if (!InstallConsole(cx, global))       { fprintf(stderr, "InstallConsole failed\n"); return false; }
    if (!InstallProcess(cx, global, argc, argv))
                                           { fprintf(stderr, "InstallProcess failed\n"); return false; }
    if (!InstallFsSync(cx, global))        { fprintf(stderr, "InstallFs failed\n"); return false; }
    if (!InstallPath(cx, global))          { fprintf(stderr, "InstallPath failed\n"); return false; }
    if (!InstallBuffer(cx, global))        { fprintf(stderr, "InstallBuffer failed\n"); return false; }
    if (!InstallRequire(cx, global))       { fprintf(stderr, "InstallRequire failed\n"); return false; }
    if (!InstallTimers(cx, global))        { fprintf(stderr, "InstallTimers failed\n"); return false; }
    if (!InstallCrypto(cx, global))        { fprintf(stderr, "InstallCrypto failed\n"); return false; }
    if (!InstallHttp(cx, global))          { fprintf(stderr, "InstallHttp failed\n"); return false; }

    JS::CompileOptions opts(cx);
    opts.setFileAndLine("<ionpower-node bootstrap>", 1);
    JS::RootedValue discard(cx);
    if (!JS::Evaluate(cx, opts, kBootstrapJS, sizeof(kBootstrapJS) - 1, &discard)) {
        fprintf(stderr, "bootstrap evaluate failed\n");
        return false;
    }
    return true;
}

} // namespace ionpower
