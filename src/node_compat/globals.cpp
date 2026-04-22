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

    // --- fs (public shape wrapping the __fs_native__ bindings) ---
    "  var nativeFs = __fs_native__;\n"
    "  var fs = {\n"
    "    readFileSync:   nativeFs.readFileSync,\n"
    "    writeFileSync:  nativeFs.writeFileSync,\n"
    "    existsSync:     nativeFs.existsSync,\n"
    "    readdirSync:    nativeFs.readdirSync,\n"
    "    statSync:       nativeFs.statSync,\n"
    "    lstatSync:      nativeFs.statSync,\n"
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
    "  util.inspect = function (v) {\n"
    "    if (v === null) return 'null';\n"
    "    if (v === undefined) return 'undefined';\n"
    "    if (typeof v === 'function') return '[Function' + (v.name ? ': ' + v.name : '') + ']';\n"
    "    if (typeof v === 'string') return \"'\" + v + \"'\";\n"
    "    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return '[Object]'; } }\n"
    "    return String(v);\n"
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

    // --- crypto (randomBytes + web-style getRandomValues) ---
    "  var nativeCrypto = __crypto_native__;\n"
    "  var crypto = {\n"
    "    randomBytes:     nativeCrypto.randomBytes,\n"
    "    getRandomValues: nativeCrypto.getRandomValues,\n"
    "    randomFillSync:  function (buf) { nativeCrypto.getRandomValues(buf); return buf; }\n"
    "  };\n"
    // Web Crypto lives on globalThis.crypto in browsers and Node 20+.
    "  if (typeof globalThis !== 'undefined') { globalThis.crypto = crypto; }\n"
    "  this.crypto = crypto;\n"   // also pin on global in case globalThis missing

    // --- buffer (reexport the Buffer global as a core module) ---
    "  var buffer = { Buffer: Buffer, constants: {}, kMaxLength: 0x7fffffff };\n"

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

    // --- stream (pass-through stub — only the class shape) ---
    "  function _StreamStub(name) { events.EventEmitter.call(this); this._name = name; }\n"
    "  util.inherits(_StreamStub, events.EventEmitter);\n"
    "  _StreamStub.prototype.pipe    = function (d) { return d; };\n"
    "  _StreamStub.prototype.write   = function () { return true; };\n"
    "  _StreamStub.prototype.end     = function () { return this; };\n"
    "  var stream = {\n"
    "    Readable:  _StreamStub,\n"
    "    Writable:  _StreamStub,\n"
    "    Duplex:    _StreamStub,\n"
    "    Transform: _StreamStub,\n"
    "    Stream:    _StreamStub\n"
    "  };\n"

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

    // Re-wrap __make_require__ so bare specifiers check the cache first.
    "  var origMake = __make_require__;\n"
    "  __make_require__ = function(dir) {\n"
    "    var req = origMake(dir);\n"
    "    return function(spec) {\n"
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
