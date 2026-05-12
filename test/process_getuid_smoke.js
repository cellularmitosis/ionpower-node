// process_getuid_smoke.js — process.getuid/getgid/geteuid/getegid
// (Node 10 parity, pass 6). tar's preserveOwner gate, pacote's
// selfOwner, npm-lifecycle install scripts all branch on these.

function assert(c, msg) {
    if (!c) { console.error("FAIL:", msg); process.exit(1); }
}

// All four must be functions on non-Windows builds. Node skips them
// entirely on Windows; we're always Tiger/PPC so they're always
// present.
['getuid', 'getgid', 'geteuid', 'getegid'].forEach(function (name) {
    assert(typeof process[name] === "function",
           "process." + name + " is function");
    var v = process[name]();
    assert(typeof v === "number", "process." + name + "() returns number, got " + typeof v);
    assert(v >= 0, "process." + name + "() returns non-negative, got " + v);
    assert((v | 0) === v, "process." + name + "() returns integer, got " + v);
    console.log("ok: process." + name + "() =", v);
});

// Sanity: when we're not running as root (the common case for a
// dev shell on Tiger / Leopard), getuid > 0. Skip this check if
// somehow running as root in CI — the smoke isn't gated on it,
// just informational.
var uid = process.getuid();
if (uid === 0) {
    console.log("info: running as root (uid=0); preserveOwner-style gates would activate");
} else {
    console.log("ok: running as non-root (uid=" + uid + "); tar's preserveOwner short-circuits");
}

// getuid + geteuid should match for a non-setuid process.
assert(process.getuid() === process.geteuid(),
       "uid === euid for non-setuid process; got " +
       JSON.stringify({uid: process.getuid(), euid: process.geteuid()}));
console.log("ok: getuid() === geteuid()");

assert(process.getgid() === process.getegid(),
       "gid === egid for non-setgid process; got " +
       JSON.stringify({gid: process.getgid(), egid: process.getegid()}));
console.log("ok: getgid() === getegid()");

console.log("\nprocess.getuid family smoke: all assertions passed");
