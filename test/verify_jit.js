// verify_jit.js — runnable in plain SpiderMonkey `js` shell (no Node-compat
// bridge required). Compares a tight loop with/without the JIT by asking
// the runtime to disable ion/baseline via the `options` function the shell
// provides. Meant to be run right after `make install` of mozjs completes
// as a smoke test of the IonPower backend.
//
// Usage (in stock `js` shell):
//   js --ion-eager --baseline-eager test/verify_jit.js
//   js --no-ion --no-baseline      test/verify_jit.js
//
// Same workload, different flags — we print wall time so the difference is
// visible.

function bench(name, n) {
    var t0 = dateNow();
    var acc = 0;
    for (var i = 0; i < n; ++i) {
        // mixed arith + bitops to give the JIT something interesting
        acc = ((acc + i * 3) ^ (i >>> 1)) | 0;
    }
    var t1 = dateNow();
    print(name, "n=" + n, "ms=" + (t1 - t0).toFixed(1), "acc=" + acc);
}

// `dateNow` is a SpiderMonkey shell builtin; fall back to Date.now() when
// not present (so this file also runs in ionpower-node).
if (typeof dateNow === "undefined") {
    globalThis.dateNow = function () { return Date.now(); };
}
if (typeof print === "undefined") {
    globalThis.print = console.log;
}

bench("warmup",  100000);
bench("run1",  5000000);
bench("run2", 10000000);
