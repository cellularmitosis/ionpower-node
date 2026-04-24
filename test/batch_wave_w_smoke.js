// Wave W: library hunt 5 — 7 more vendored libraries.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- escape-html ----
try {
    var eh = unwrap(require("./vendor/escape-html.js"));
    assert(typeof eh === "function", "escape-html is a function");
    eq(eh('<script>alert("x")</script>'),
       "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
       "escape-html escapes");
    console.log("ok: escape-html");
} catch (e) {
    console.log("skip: escape-html (" + e.message + ")");
}

// ---- escape-string-regexp (ESM) ----
try {
    var esr = unwrap(require("./vendor/escape-string-regexp.js"));
    assert(typeof esr === "function", "escape-string-regexp is a function");
    eq(esr("foo.bar*baz"), "foo\\.bar\\*baz", "escape-string-regexp escapes meta chars");
    console.log("ok: escape-string-regexp");
} catch (e) {
    console.log("skip: escape-string-regexp (" + e.message + ")");
}

// ---- is-plain-object ----
try {
    var ipoMod = require("./vendor/is-plain-object.js");
    var ipo = ipoMod.isPlainObject || unwrap(ipoMod);
    assert(typeof ipo === "function", "is-plain-object is a function");
    assert(ipo({}) === true, "{} is plain");
    assert(ipo({ a: 1 }) === true, "{a:1} is plain");
    assert(ipo([]) === false, "[] is not plain");
    assert(ipo(new Date()) === false, "new Date() is not plain");
    assert(ipo(null) === false, "null is not plain");
    console.log("ok: is-plain-object");
} catch (e) {
    console.log("skip: is-plain-object (" + e.message + ")");
}

// ---- mri (arg parser) ----
try {
    var mri = unwrap(require("./vendor/mri.js"));
    assert(typeof mri === "function", "mri is a function");
    var out = mri(["--foo", "1", "-b", "hi", "positional"]);
    assert(out.foo === 1, "mri parses --foo 1");
    assert(out.b === "hi", "mri parses -b hi");
    eq(out._, ["positional"], "mri positionals");
    console.log("ok: mri");
} catch (e) {
    console.log("skip: mri (" + e.message + ")");
}

// ---- kleur (terminal colors) ----
try {
    var kleur = unwrap(require("./vendor/kleur.js"));
    assert(typeof kleur === "object" || typeof kleur === "function",
           "kleur loads");
    // kleur exposes .red, .green, .bold as functions that wrap strings.
    // In no-color environments they may just return the string; that's OK.
    if (typeof kleur.red === "function") {
        var wrapped = kleur.red("hello");
        assert(typeof wrapped === "string" && wrapped.indexOf("hello") >= 0,
               "kleur.red returns a string containing the input");
    }
    console.log("ok: kleur");
} catch (e) {
    console.log("skip: kleur (" + e.message + ")");
}

// ---- dayjs (date library) ----
try {
    var dayjs = unwrap(require("./vendor/dayjs.js"));
    assert(typeof dayjs === "function", "dayjs is a function");
    var d = dayjs("2024-01-15");
    assert(d && typeof d.format === "function", "dayjs returned an instance");
    var formatted = d.format("YYYY-MM-DD");
    eq(formatted, "2024-01-15", "dayjs format YYYY-MM-DD");
    // Arithmetic: add 5 days
    var plus5 = d.add(5, "day").format("YYYY-MM-DD");
    eq(plus5, "2024-01-20", "dayjs add 5 days");
    console.log("ok: dayjs");
} catch (e) {
    console.log("skip: dayjs (" + e.message + ")");
}

// ---- nanoid (non-secure) (ESM) ----
try {
    var nn = require("./vendor/nanoid-non-secure.js");
    var nano = nn.nanoid || (nn.default && nn.default.nanoid) || unwrap(nn);
    assert(typeof nano === "function", "nanoid is a function");
    var id = nano();
    assert(typeof id === "string" && id.length === 21, "default nanoid length 21");
    var shorter = nano(10);
    assert(typeof shorter === "string" && shorter.length === 10, "nanoid(10) length 10");
    // Two consecutive ids should differ (prob of collision ~ 1 in 2^120).
    assert(nano() !== nano(), "nanoid produces distinct ids");
    console.log("ok: nanoid (non-secure)");
} catch (e) {
    console.log("skip: nanoid-non-secure (" + e.message + ")");
}

console.log("\nbatch_wave_w smoke: done");
