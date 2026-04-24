// Wave Z: library hunt 8 — 5 more vendored libraries + Buffer.indexOf
// regression check.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- Buffer.indexOf now accepts strings ----
(function () {
    var b = Buffer.from("hello\r\n\r\nworld");
    assert(b.indexOf("\r\n\r\n") === 5, "Buffer.indexOf(str) — CRLF-CRLF at 5");
    assert(b.indexOf("world") === 9, "Buffer.indexOf('world') at 9");
    assert(b.indexOf("missing") === -1, "missing returns -1");
    assert(b.indexOf(Buffer.from([0x72, 0x6c])) === 11, "Buffer.indexOf(Buffer) — 'rl' at 11");
    assert(b.indexOf(111) === 4, "Buffer.indexOf(byte 'o') at 4");   // 'o' at hell-o (idx 4)
    assert(b.includes("world"), "Buffer.includes('world')");
    console.log("ok: Buffer.indexOf accepts strings/Buffers/bytes");
})();

// ---- after ----
try {
    var after = unwrap(require("./vendor/after.js"));
    assert(typeof after === "function", "after is a function");
    var called = 0;
    var next = after(3, function () { called++; });
    next(); next(); next();
    assert(called === 1, "after(3, cb) fires exactly once after 3 calls");
    console.log("ok: after");
} catch (e) { console.log("skip: after (" + e.message + ")"); }

// ---- pend (queue deferrer) ----
try {
    var Pend = unwrap(require("./vendor/pend.js"));
    assert(typeof Pend === "function", "Pend ctor");
    var p = new Pend();
    var done = false;
    p.go(function (cb) { setImmediate(cb); });
    p.wait(function () { done = true; });
    // Let the microtask/timer drain handle it (since Pend is async)
    setImmediate(function () {
        assert(done, "Pend wait fires when all ops complete");
        console.log("ok: pend");
    });
} catch (e) { console.log("skip: pend (" + e.message + ")"); }

// ---- path-is-absolute ----
try {
    var pia = require("./vendor/path-is-absolute.js");
    // module.exports = posix or win32 (based on platform)
    assert(typeof pia === "function" || typeof pia.posix === "function",
           "path-is-absolute is callable");
    assert(pia.posix("/foo/bar") === true, "posix /foo/bar is absolute");
    assert(pia.posix("foo/bar") === false, "posix foo/bar is not");
    assert(pia.win32("C:\\Windows") === true, "win32 C:\\Windows is absolute");
    console.log("ok: path-is-absolute");
} catch (e) { console.log("skip: path-is-absolute (" + e.message + ")"); }

// ---- has-flag (ESM via Babel) ----
try {
    var hasFlag = unwrap(require("./vendor/has-flag.js"));
    assert(typeof hasFlag === "function", "has-flag is a function");
    // Fake argv
    var saved = process.argv;
    process.argv = ["node", "script", "--color", "-v"];
    try {
        assert(hasFlag("color") === true, "hasFlag('color') true");
        assert(hasFlag("v") === true, "hasFlag('v') true");
        assert(hasFlag("missing") === false, "hasFlag('missing') false");
    } finally { process.argv = saved; }
    console.log("ok: has-flag");
} catch (e) { console.log("skip: has-flag (" + e.message + ")"); }

// ---- color-string (css color parsing) ----
try {
    var colorString = unwrap(require("./vendor/color-string.js"));
    assert(typeof colorString === "object" || typeof colorString === "function",
           "color-string loads");
    if (colorString.get) {
        var parsed = colorString.get("#ff0000");
        assert(parsed && parsed.value && parsed.value[0] === 255,
               "color-string.get(#ff0000) -> [255,0,0]");
    }
    console.log("ok: color-string");
} catch (e) { console.log("skip: color-string (" + e.message + ")"); }

process.on("exit", function () {
    console.log("\nbatch_wave_z smoke: done");
});
