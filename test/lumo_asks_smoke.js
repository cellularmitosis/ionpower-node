// Smoke for the lumo round-2 asks (handoff at docs/sessions/050-handoff-from-lumo/):
//   - process.binding('util').{start,stop}SigintWatchdog + watchdogHasPendingSigint
//   - v8.setFlagsFromString
//   - readline.emitKeypressEvents
//   - _ReadlineInterface.prototype._setRawMode
//   - _ReadlineInterface auto-resumes input on construction
//   - _ReadlineInterface.{input,output} aliases for ._input / ._output
//
// Each ask is a small no-op-or-light-shim aimed at making Lumo's bundle
// load without a wrapper. We can't actually verify behavior at runtime
// (no SIGINT handler, no real raw mode, no V8 to flag) but we can verify
// the API surface exists with the right shape.

var assert = function (cond, msg) {
    if (!cond) {
        console.log('FAIL ' + msg);
        process.exit(1);
    }
};

// Ask 2: process.binding('util') sigint watchdog stubs
var utilBinding = process.binding('util');
assert(typeof utilBinding === 'object' && utilBinding !== null,
       'process.binding("util") returned ' + typeof utilBinding);
assert(typeof utilBinding.startSigintWatchdog === 'function',
       'startSigintWatchdog not a function');
assert(typeof utilBinding.stopSigintWatchdog === 'function',
       'stopSigintWatchdog not a function');
assert(typeof utilBinding.watchdogHasPendingSigint === 'function',
       'watchdogHasPendingSigint not a function');
// Calling must not throw.
utilBinding.startSigintWatchdog();
assert(utilBinding.stopSigintWatchdog() === false,
       'stopSigintWatchdog should return false');
assert(utilBinding.watchdogHasPendingSigint() === false,
       'watchdogHasPendingSigint should return false');

// Ask 3: v8.setFlagsFromString
var v8 = require('v8');
assert(typeof v8.setFlagsFromString === 'function',
       'v8.setFlagsFromString not a function');
v8.setFlagsFromString('--use_strict');  // no-op, must not throw

// Ask 4: readline.emitKeypressEvents
var readline = require('readline');
assert(typeof readline.emitKeypressEvents === 'function',
       'readline.emitKeypressEvents not a function');
readline.emitKeypressEvents(process.stdin);  // no-op, must not throw

// Build a fake readable stream for the next checks (don't touch real
// stdin — would block).
var events = require('events');
function FakeStream() {
    events.EventEmitter.call(this);
    this.isRaw = false;
    this._resumed = false;
}
FakeStream.prototype = Object.create(events.EventEmitter.prototype);
FakeStream.prototype.pause      = function () { this._resumed = false; return this; };
FakeStream.prototype.resume     = function () { this._resumed = true;  return this; };
FakeStream.prototype.setRawMode = function (raw) { this.isRaw = !!raw; return this; };

var fakeIn  = new FakeStream();
var fakeOut = { write: function () {} };

// Ask 6: rl construction auto-resumes input. Without this fix, a freshly-
// created Interface on a real TTY sits paused and 'data' never fires.
var rl = readline.createInterface({ input: fakeIn, output: fakeOut });
assert(fakeIn._resumed === true,
       'rl construction did not call input.resume() (pty stdin gap)');

// Bonus: rl.input / rl.output aliases
assert(rl.input === fakeIn,
       'rl.input alias missing (expected === options.input)');
assert(rl.output === fakeOut,
       'rl.output alias missing (expected === options.output)');

// Ask 5: rl._setRawMode delegates to input.setRawMode and returns previous.
assert(typeof rl._setRawMode === 'function',
       'rl._setRawMode not a function');
// Set raw = true. Previous was false (FakeStream initial). Returns false.
var prev1 = rl._setRawMode(true);
assert(prev1 === false, 'rl._setRawMode(true) returned ' + JSON.stringify(prev1) + ', expected false');
assert(fakeIn.isRaw === true, 'input.setRawMode not invoked / state not updated');
// Set raw = false. Previous was true. Returns true.
var prev2 = rl._setRawMode(false);
assert(prev2 === true, 'rl._setRawMode(false) returned ' + JSON.stringify(prev2) + ', expected true');
assert(fakeIn.isRaw === false, 'input.setRawMode(false) not invoked');

// _setRawMode on a stream without setRawMode (no-op fallback, returns false).
var bareIn  = new FakeStream();
delete bareIn.setRawMode;
var bareRl = readline.createInterface({ input: bareIn, output: fakeOut });
assert(bareRl._setRawMode(true) === false,
       'rl._setRawMode on a stream without setRawMode should return false');

rl.close();
bareRl.close();

console.log('PASS lumo_asks_smoke (6 lumo round-2 asks verified at API level)');
