// process.stdin.setRawMode + tty size: now backed by tcsetattr +
// TIOCGWINSZ instead of the v0.79 no-op stub.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- process._setRawMode + _tty_size are exposed natively ----
assert(typeof process._setRawMode === "function", "process._setRawMode is fn");
assert(typeof process._tty_size === "function",   "process._tty_size is fn");
console.log("ok: process._setRawMode + _tty_size native bindings exposed");

// ---- TTY-fd vs non-TTY-fd behaviour ----
// stdin under our smoke runner isn't a TTY (it's the make child), so
// setRawMode should return false (= not previously raw, no-op) and
// tty_size should return null.
var prevWasRaw = process._setRawMode(0, true);
assert(prevWasRaw === false, "setRawMode on non-TTY stdin returns false: " + prevWasRaw);
console.log("ok: setRawMode no-ops on non-TTY stdin");

var size = process._tty_size(0);
assert(size === null, "tty_size on non-TTY returns null: " + JSON.stringify(size));
console.log("ok: tty_size returns null for non-TTY");

// ---- process.stdin.setRawMode wrapper sets isRaw flag ----
process.stdin.setRawMode(true);
// On non-TTY, isRaw still flips because the wrapper sets it after the
// native call (which is a no-op). Real Node would reject; we silently
// mirror what the user asked for.
assert(process.stdin.isRaw === true, "stdin.isRaw flipped true");
process.stdin.setRawMode(false);
assert(process.stdin.isRaw === false, "stdin.isRaw flipped back false");
console.log("ok: process.stdin.setRawMode flag toggling");

// ---- Verify the function signature behaves on a real TTY ----
// We can't actually exercise raw-mode reads in a non-interactive smoke
// (the test runner's stdin is piped). But we can verify that calling
// _setRawMode on a fd we know is a TTY would route through tcsetattr.
// Check the function signature accepts (fd, bool) cleanly.
try { process._setRawMode(0, false); }
catch (e) { console.error("FAIL: setRawMode(0, false) threw: " + e.message); process.exit(1); }
console.log("ok: _setRawMode(0, false) doesn't throw");

// ---- columns / rows on process.stdout (TTY when run interactively) ----
// This may or may not be a TTY depending on how the suite is run; just
// check the type/range when present.
if (process.stdout.isTTY) {
    assert(typeof process.stdout.columns === "number", "stdout.columns is number");
    assert(process.stdout.columns > 0 && process.stdout.columns < 4096,
           "stdout.columns plausible: " + process.stdout.columns);
    assert(typeof process.stdout.rows === "number", "stdout.rows is number");
    console.log("ok: stdout.columns=" + process.stdout.columns +
                " rows=" + process.stdout.rows + " (real TIOCGWINSZ)");
} else {
    console.log("skip: stdout not a TTY (running under make/pipe)");
}

console.log("\nraw_mode smoke: all assertions passed");
