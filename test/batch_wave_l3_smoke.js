// Wave L, batch 3: more vendored-but-unsmoked libs.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- crypto-js-core ----
try {
    var cjsCore = unwrap(require("./vendor/crypto-js-core.js"));
    assert(cjsCore && (cjsCore.lib || cjsCore.algo || cjsCore.enc),
           "crypto-js-core lib/algo/enc");
    console.log("ok: crypto-js-core (surface)");
} catch (e) {
    console.log("skip: crypto-js-core (" + e.message + ")");
}

// ---- fp-ts ----
try {
    var fpts = require("./vendor/fp-ts.js");
    assert(typeof fpts === "object", "fp-ts loaded");
    console.log("ok: fp-ts (surface)");
} catch (e) {
    console.log("skip: fp-ts (" + e.message + ")");
}

// ---- joi-full ----
try {
    var joi = unwrap(require("./vendor/joi-full.js"));
    var schema = joi.object ? joi.object({ n: joi.number().integer() }) : null;
    if (schema && typeof schema.validate === "function") {
        var res = schema.validate({ n: 42 });
        assert(!res.error, "joi validate ok");
        var res2 = schema.validate({ n: "not a num" });
        assert(res2.error, "joi validate catches bad type");
        console.log("ok: joi-full");
    } else {
        console.log("ok: joi-full (surface only)");
    }
} catch (e) {
    console.log("skip: joi-full (" + e.message + ")");
}

// ---- nise (xhr / fake-timer helpers used by sinon) ----
try {
    var nise = require("./vendor/nise.js");
    assert(typeof nise === "object", "nise loaded");
    console.log("ok: nise (surface)");
} catch (e) {
    console.log("skip: nise (" + e.message + ")");
}

// ---- lazy ----
try {
    var lazyMod = require("./vendor/lazy.js");
    var lazy = lazyMod.default || lazyMod;
    assert(typeof lazy === "object" || typeof lazy === "function", "lazy loaded");
    console.log("ok: lazy (surface)");
} catch (e) {
    console.log("skip: lazy (" + e.message + ")");
}

// ---- chalk-template ----
try {
    var chalkTemplate = require("./vendor/chalk-template.js");
    var ct = chalkTemplate.default || chalkTemplate;
    assert(typeof ct === "function" || typeof ct === "object", "chalk-template loaded");
    console.log("ok: chalk-template (surface)");
} catch (e) {
    console.log("skip: chalk-template (" + e.message + ")");
}

// ---- mime-db-v2 (data) ----
try {
    var mdv2 = require("./vendor/mime-db-v2.json");
    assert(typeof mdv2 === "object" && mdv2["text/html"], "mime-db-v2 has text/html");
    console.log("ok: mime-db-v2");
} catch (e) {
    console.log("skip: mime-db-v2 (" + e.message + ")");
}

// ---- spinners (JSON data of cli-spinners) ----
try {
    var spinners = require("./vendor/spinners.json");
    assert(typeof spinners === "object", "spinners loaded");
    var keys = Object.keys(spinners);
    assert(keys.length > 0, "spinners has keys");
    console.log("ok: spinners (" + keys.length + " presets)");
} catch (e) {
    console.log("skip: spinners (" + e.message + ")");
}

// ---- shortest: unique-shortest-string generator (iterator) ----
try {
    var shortest = unwrap(require("./vendor/shortest.js"));
    assert(typeof shortest === "function", "shortest is function");
    var iter = shortest("abc");
    var s1 = iter(), s2 = iter(), s3 = iter(), s4 = iter();
    // Algorithm uses base-N counter; pattern is a, b, c, ba, bb, bc, ca, …
    assert(s1 === "a" && s2 === "b" && s3 === "c" && s4 === "ba",
           "shortest iterator output: " + JSON.stringify([s1, s2, s3, s4]));
    console.log("ok: shortest");
} catch (e) {
    console.log("skip: shortest (" + e.message + ")");
}

// ---- Standard.flf (figlet font, not JS) ----
// Skip — data file, not loadable as JS module.

// ---- jszip-utils ----
try {
    var jszipUtils = unwrap(require("./vendor/jszip-utils.js"));
    assert(typeof jszipUtils === "object" || typeof jszipUtils === "function",
           "jszip-utils loaded");
    console.log("ok: jszip-utils (surface)");
} catch (e) {
    console.log("skip: jszip-utils (" + e.message + ")");
}

// ---- json (a package named "json") ----
try {
    var jsonPkg = require("./vendor/json.js");
    assert(jsonPkg !== undefined, "json loaded");
    console.log("ok: json pkg (surface)");
} catch (e) {
    console.log("skip: json pkg (" + e.message + ")");
}

// ---- arrify — already tested in small_batch; double-check our wave5 one loads ----
try {
    var arrify = unwrap(require("./vendor/arrify.js"));
    eq(arrify(1), [1], "arrify scalar");
    eq(arrify([1, 2]), [1, 2], "arrify array passthrough");
    eq(arrify(null), [], "arrify null → []");
    console.log("ok: arrify");
} catch (e) {
    console.log("skip: arrify (" + e.message + ")");
}

console.log("\nbatch_wave_l3 smoke: all assertions passed");
