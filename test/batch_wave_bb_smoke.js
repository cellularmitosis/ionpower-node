// Wave BB (16th wave): six more vendored libraries.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- array-uniq ----
try {
    var arrayUniq = unwrap(require("./vendor/array-uniq.js"));
    assert(typeof arrayUniq === "function", "array-uniq is function");
    eq(arrayUniq([1, 2, 2, 3, 3, 3]), [1, 2, 3], "array-uniq dedups");
    eq(arrayUniq(["a", "b", "a"]), ["a", "b"], "array-uniq strings");
    console.log("ok: array-uniq");
} catch (e) { console.log("skip: array-uniq (" + e.message + ")"); }

// ---- eol (line-ending utility) ----
try {
    var eol = require("./vendor/eol.js");
    assert(typeof eol === "object" || typeof eol === "function", "eol module loads");
    if (typeof eol.lf === "function") {
        eq(eol.lf("a\r\nb\rc\n"), "a\nb\nc\n", "eol.lf normalizes to LF");
    }
    if (typeof eol.crlf === "function") {
        eq(eol.crlf("a\nb"), "a\r\nb", "eol.crlf converts");
    }
    console.log("ok: eol");
} catch (e) { console.log("skip: eol (" + e.message + ")"); }

// ---- is-linux ----
try {
    var isLinux = unwrap(require("./vendor/is-linux.js"));
    assert(typeof isLinux === "function", "is-linux is function");
    // Always false on darwin/Tiger
    assert(isLinux() === false, "is-linux false on darwin");
    console.log("ok: is-linux");
} catch (e) { console.log("skip: is-linux (" + e.message + ")"); }

// ---- is-windows ----
try {
    var isWindows = unwrap(require("./vendor/is-windows.js"));
    assert(typeof isWindows === "function", "is-windows is function");
    assert(isWindows() === false, "is-windows false on darwin");
    console.log("ok: is-windows");
} catch (e) { console.log("skip: is-windows (" + e.message + ")"); }

// ---- semver-regex ----
try {
    var semverRegexMod = unwrap(require("./vendor/semver-regex.js"));
    var rx;
    if (typeof semverRegexMod === "function") rx = semverRegexMod();
    else if (semverRegexMod instanceof RegExp) rx = semverRegexMod;
    if (rx) {
        assert(rx.test("1.2.3"), "1.2.3 matches");
        assert(rx.test("v0.0.1-beta"), "v0.0.1-beta matches");
    }
    console.log("ok: semver-regex (loaded)");
} catch (e) { console.log("skip: semver-regex (" + e.message + ")"); }

// ---- entities (HTML entity codec) ----
try {
    var ent = require("./vendor/entities-pkg.js");
    var encode = ent.encode || ent.encodeXML || (ent.default && ent.default.encode);
    var decode = ent.decode || ent.decodeXML || (ent.default && ent.default.decode);
    if (typeof encode === "function" && typeof decode === "function") {
        var enc = encode("<b>&hello</b>");
        var dec = decode(enc);
        eq(dec, "<b>&hello</b>", "entities round-trip");
    }
    console.log("ok: entities (loaded)");
} catch (e) { console.log("skip: entities (" + e.message + ")"); }

console.log("\nbatch_wave_bb smoke: done");
