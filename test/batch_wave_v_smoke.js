// Wave V: final library batch for v0.23.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- tweetnacl (pure-JS crypto library) ----
try {
    var nacl = unwrap(require("./vendor/tweetnacl.js"));
    assert(typeof nacl.hash === "function" || typeof nacl.sign === "function",
           "tweetnacl has hash or sign");
    if (typeof nacl.randomBytes === "function") {
        var r = nacl.randomBytes(32);
        assert(r.length === 32, "tweetnacl.randomBytes length");
    }
    console.log("ok: tweetnacl (surface)");
} catch (e) {
    console.log("skip: tweetnacl (" + e.message + ")");
}

// ---- fast-json-stable-stringify (deterministic JSON) ----
try {
    var stable = unwrap(require("./vendor/fast-json-stable-stringify.js"));
    eq(stable({ b: 1, a: 2 }), '{"a":2,"b":1}', "fast-json-stable-stringify sorts keys");
    eq(stable({ x: [1, 2, { d: 4, c: 3 }] }), '{"x":[1,2,{"c":3,"d":4}]}',
       "nested sorted");
    console.log("ok: fast-json-stable-stringify");
} catch (e) {
    console.log("skip: fast-json-stable-stringify (" + e.message + ")");
}

// ---- stable-sort ----
try {
    var stableSort = unwrap(require("./vendor/stable-sort.js"));
    var sorted = stableSort([3, 1, 4, 1, 5, 9, 2, 6], function (a, b) { return a - b; });
    eq(sorted, [1, 1, 2, 3, 4, 5, 6, 9], "stable sort result");
    console.log("ok: stable-sort");
} catch (e) {
    console.log("skip: stable-sort (" + e.message + ")");
}

// ---- emoji-regex v10 ----
try {
    var emoji = unwrap(require("./vendor/emoji-regex-v10.js"));
    var re = typeof emoji === "function" ? emoji() : emoji;
    assert(re instanceof RegExp, "emoji-regex returns RegExp");
    assert(re.test("Hello \u{1F600} World"), "detects emoji");
    console.log("ok: emoji-regex v10");
} catch (e) {
    console.log("skip: emoji-regex-v10 (" + e.message + ")");
}

console.log("\nbatch_wave_v smoke: done");
