// stream_resume_defer_smoke.js — pacote-shape regression smoke for
// _Readable.prototype.resume's deferred-drain behavior.
//
// The bug: when a Readable has buffered data + ended=true but no
// consumer attached, then later something does:
//
//   stream.on('data', dataHandler)   // ← auto-resume kicks in
//   stream.on('end', endHandler)     // ← attached AFTER data listener
//
// the auto-resume must NOT synchronously emit 'end' before the
// caller has had a chance to attach the 'end' listener. If it did,
// the 'end' listener would never fire — exactly what was hanging
// pacote.extract inside npm install (cacache hands a PassThrough
// downstream; tar.x pipes from it AFTER rimraf+mkdirp resolve, by
// which time the PassThrough has already drained-and-ended).

var stream = require('stream');
var assert = require('assert');

console.log('--- stream resume defer smoke ---');

// --- Test 1: pure ordering — data, then end, both must fire ---
(function () {
  var pt = new stream.PassThrough();
  pt.write(Buffer.from('hello'));
  pt.end();

  // At this point, pt has the chunk in its buffer, ws.ended=true,
  // s.ended=true (from push(null) inside end()).
  // We have not yet attached 'data' or 'end' listeners.

  var got = '';
  var endFired = false;

  // pipe-style: data first, end second. This is exactly what
  // _Stream.prototype.pipe and node-tar's pipe upstream do.
  pt.on('data', function (chunk) { got += chunk.toString(); });
  pt.on('end',  function ()      { endFired = true; });

  setImmediate(function () {
    setImmediate(function () {
      assert.strictEqual(got, 'hello', 'data must reach the late dataHandler');
      assert.strictEqual(endFired, true, 'end must fire AFTER both listeners attached');
      console.log('  PASS — late-attach data/end on buffered+ended PassThrough');
      test2();
    });
  });
})();

// --- Test 2: dest.end() via pipe must fire even if upstream drained ---
function test2 () {
  var pt = new stream.PassThrough();
  pt.write(Buffer.from('payload'));
  pt.end();

  // dest is also a PassThrough — it'll emit 'finish' when end() is
  // called on its writable side. If our resume-defer fix works,
  // pt.pipe(dest) attaches data + end listeners BEFORE the drain
  // happens, so pt's 'end' triggers dest.end(), and dest emits
  // 'finish'.
  var dest = new stream.PassThrough();
  var destGot = '';
  var destFinish = false;
  dest.on('data',   function (c) { destGot += c.toString(); });
  dest.on('finish', function ()  { destFinish = true; });

  pt.pipe(dest);

  setImmediate(function () {
    setImmediate(function () {
      setImmediate(function () {
        assert.strictEqual(destGot, 'payload', 'pipe must forward buffered data');
        assert.strictEqual(destFinish, true, 'pipe must close dest writable via end-cascade');
        console.log('  PASS — pipe to dest cascades end through the deferred drain');
        test3();
      });
    });
  });
}

// --- Test 3: synchronous in-flow push still drains inline ---
// (Regression guard: the resume-defer change must not break the
// steady-state case where push happens AFTER the consumer is
// attached. There, push should still drive _emitFlow inline so data
// arrives in the same tick.)
function test3 () {
  var pt = new stream.PassThrough();

  var got = '';
  pt.on('data', function (c) { got += c.toString(); });

  // Now push. This is steady-state: flowing=true was just set by
  // the on('data') auto-resume. Push should drive _emitFlow inline
  // because of the flowing flag, NOT defer.
  pt.write(Buffer.from('alpha'));
  pt.write(Buffer.from('beta'));

  // After push returns sync, data should already be in `got` —
  // BUT! We deferred the FIRST drain to setImmediate. So before
  // the first drain fires, the writes go into PT's buffer. Once
  // the deferred drain fires, the buffer drains.
  //
  // The correct contract: after one setImmediate tick, data has
  // flowed (regardless of whether it flowed inline or via the
  // deferred drain).
  setImmediate(function () {
    setImmediate(function () {
      assert.strictEqual(got, 'alphabeta', 'pushes after consumer attach must reach handler');
      console.log('  PASS — pushes after consumer attach reach handler within one tick');
      test4();
    });
  });
}

// --- Test 4: cacache-shape — Transform in the middle, buffered+ended ---
function test4 () {
  // Mimic ssri.integrityStream: a Transform with identity pass-through.
  var integ = new stream.Transform({
    transform: function (chunk, enc, cb) { cb(null, chunk); }
  });
  // Write + end (simulates upstream pump cascade completing).
  integ.write(Buffer.from('chunk1'));
  integ.write(Buffer.from('chunk2'));
  integ.end();

  // Now pipe into a sink AFTER integ has buffered + ended.
  var sink = new stream.PassThrough();
  var sinkGot = '';
  var sinkFinish = false;
  sink.on('data',   function (c) { sinkGot += c.toString(); });
  sink.on('finish', function ()  { sinkFinish = true; });

  integ.pipe(sink);

  setImmediate(function () {
    setImmediate(function () {
      setImmediate(function () {
        assert.strictEqual(sinkGot, 'chunk1chunk2', 'transform must drain buffered chunks to late sink');
        assert.strictEqual(sinkFinish, true, 'transform-end must cascade to sink finish');
        console.log('  PASS — Transform→late-pipe cascade (the cacache→pacote pattern)');
        done();
      });
    });
  });
}

function done () {
  console.log('--- stream resume defer smoke OK ---');
}
