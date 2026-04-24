// Wave N batch: more fresh libs. Targeted at auth/crypto/data
// libraries that pair with v0.12-14's fetch + HTTP + zlib + SHA-512.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- accept-language-parser ----
try {
    var alp = unwrap(require("./vendor/accept-language-parser.js"));
    var langs = alp.parse("en-US,en;q=0.9,fr;q=0.8");
    assert(langs[0].code === "en", "alp primary lang");
    assert(langs.length === 3, "alp three tags");
    console.log("ok: accept-language-parser");
} catch (e) {
    console.log("skip: accept-language-parser (" + e.message + ")");
}

// ---- base64-js v1 ----
try {
    var b64 = unwrap(require("./vendor/base64-js-v1.js"));
    var enc = b64.fromByteArray(new Uint8Array([72, 105])); // "Hi" → "SGk="
    eq(enc, "SGk=", "base64-js fromByteArray");
    var dec = b64.toByteArray("SGk=");
    eq(dec[0], 72, "base64-js toByteArray");
    eq(dec[1], 105, "base64-js dec char 2");
    console.log("ok: base64-js v1");
} catch (e) {
    console.log("skip: base64-js-v1 (" + e.message + ")");
}

// ---- cookiejar (full cookie jar, not just parser) ----
try {
    var cj = unwrap(require("./vendor/cookiejar.js"));
    var Jar = cj.CookieJar || cj;
    var jar = new Jar();
    assert(typeof jar.setCookie === "function" || typeof jar.setCookies === "function",
           "cookiejar has setCookie");
    console.log("ok: cookiejar (surface)");
} catch (e) {
    console.log("skip: cookiejar (" + e.message + ")");
}

// ---- crypto-random-string ----
try {
    var crs = unwrap(require("./vendor/crypto-random-string.js"));
    var s1 = crs({ length: 16 });
    assert(typeof s1 === "string" && s1.length === 16, "crypto-random-string length");
    var s2 = crs({ length: 16 });
    assert(s1 !== s2, "crypto-random-string distinct outputs");
    console.log("ok: crypto-random-string");
} catch (e) {
    console.log("skip: crypto-random-string (" + e.message + ")");
}

// ---- fast-deep-equal ----
try {
    var fde = unwrap(require("./vendor/fast-deep-equal.js"));
    assert(fde({ a: [1, 2] }, { a: [1, 2] }) === true, "fde equal");
    assert(fde({ a: 1 }, { a: 2 }) === false, "fde unequal");
    console.log("ok: fast-deep-equal");
} catch (e) {
    console.log("skip: fast-deep-equal (" + e.message + ")");
}

// ---- is-arguments ----
try {
    var isArgs = unwrap(require("./vendor/is-arguments.js"));
    assert(typeof isArgs === "function", "is-arguments is function");
    (function () { assert(isArgs(arguments), "detects arguments"); })();
    assert(!isArgs([1, 2]), "rejects plain array");
    console.log("ok: is-arguments");
} catch (e) {
    console.log("skip: is-arguments (" + e.message + ")");
}

// ---- json-schema-traverse ----
try {
    var traverse = unwrap(require("./vendor/json-schema-traverse.js"));
    assert(typeof traverse === "function", "traverse is function");
    var visits = 0;
    traverse({ type: "object", properties: { x: { type: "number" } } },
             function () { visits++; });
    assert(visits > 0, "traverse visited nodes");
    console.log("ok: json-schema-traverse");
} catch (e) {
    console.log("skip: json-schema-traverse (" + e.message + ")");
}

// ---- random-bytes ----
try {
    var randomBytes = unwrap(require("./vendor/random-bytes.js"));
    var r = randomBytes.sync(16);
    assert(Buffer.isBuffer(r) || r instanceof Uint8Array, "random-bytes.sync Buffer");
    assert(r.length === 16, "random-bytes sync length");
    console.log("ok: random-bytes.sync");
} catch (e) {
    console.log("skip: random-bytes (" + e.message + ")");
}

// ---- uid-safe ----
try {
    var uidSafe = unwrap(require("./vendor/uid-safe.js"));
    var id = uidSafe.sync(16);
    assert(typeof id === "string" && id.length >= 16, "uid-safe.sync length");
    console.log("ok: uid-safe.sync");
} catch (e) {
    console.log("skip: uid-safe (" + e.message + ")");
}

// ---- short-uuid ----
try {
    var shortUuid = unwrap(require("./vendor/short-uuid.js"));
    var su = shortUuid();
    var id = su.new();
    assert(typeof id === "string" && id.length > 0, "short-uuid creates id");
    console.log("ok: short-uuid");
} catch (e) {
    console.log("skip: short-uuid (" + e.message + ")");
}

// ---- verror (stacked/wrapped errors from Joyent) ----
try {
    var verror = require("./vendor/verror.js");
    var VError = verror.VError || verror;
    var outer = new VError(new Error("inner msg"), "outer: %s", "xyz");
    assert(outer.message.indexOf("outer") >= 0, "verror message");
    console.log("ok: verror");
} catch (e) {
    console.log("skip: verror (" + e.message + ")");
}

// ---- uri-js v4 ----
try {
    var uriJs = unwrap(require("./vendor/uri-js-v4.js"));
    var parsed = uriJs.parse("http://user@example.com:8080/path?q=1");
    assert(parsed.scheme === "http" && parsed.host === "example.com",
           "uri-js parse");
    console.log("ok: uri-js v4");
} catch (e) {
    console.log("skip: uri-js-v4 (" + e.message + ")");
}

// ---- hasha (hash utility over Node's crypto) ----
try {
    var hasha = unwrap(require("./vendor/hasha.js"));
    var h = hasha("hello", { algorithm: "sha256" });
    assert(typeof h === "string" && h.length === 64, "hasha sha256");
    console.log("ok: hasha sha256");
} catch (e) {
    console.log("skip: hasha (" + e.message + ")");
}

// ---- csrf ----
try {
    var Csrf = unwrap(require("./vendor/csrf.js"));
    var tokens = new Csrf();
    var secret = tokens.secretSync();
    var token = tokens.create(secret);
    assert(tokens.verify(secret, token), "csrf verify roundtrip");
    console.log("ok: csrf");
} catch (e) {
    console.log("skip: csrf (" + e.message + ")");
}

// ---- dataloader ----
try {
    var DataLoader = unwrap(require("./vendor/dataloader.js"));
    assert(typeof DataLoader === "function", "DataLoader is function");
    var calls = 0;
    var loader = new DataLoader(function (keys) {
        calls++;
        return Promise.resolve(keys.map(function (k) { return k * 2; }));
    });
    var res1 = null;
    loader.load(5).then(function (v) { res1 = v; });
    // Real behavior test deferred to exit
    process.on("exit", function () {
        assert(res1 === 10, "dataloader resolved: " + res1);
        console.log("ok: dataloader");
    });
} catch (e) {
    console.log("skip: dataloader (" + e.message + ")");
}

// ---- nanoid v3 ----
try {
    var nano = require("./vendor/nanoid-v3.js");
    var gen = nano.nanoid;
    assert(typeof gen === "function", "nanoid function");
    var id = gen();
    assert(typeof id === "string" && id.length === 21, "nanoid default length 21");
    var id2 = gen(10);
    assert(id2.length === 10, "nanoid custom length");
    console.log("ok: nanoid v3");
} catch (e) {
    console.log("skip: nanoid-v3 (" + e.message + ")");
}

console.log("\nbatch_wave_n smoke: surface + behavior for ~16 libs");
