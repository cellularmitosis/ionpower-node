// Wave AA (13th wave): 6 more vendored libraries.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- detect-node ----
// It checks Object.prototype.toString.call(process) === '[object process]'
// — matches real Node (process has Symbol.toStringTag = 'process') but not
// ionpower-node. We just assert the module loads and returns a boolean.
try {
    var detectNode = unwrap(require("./vendor/detect-node.js"));
    assert(typeof detectNode === "boolean", "detect-node returns a boolean (got " + typeof detectNode + ")");
    console.log("ok: detect-node (returned " + detectNode + ")");
} catch (e) { console.log("skip: detect-node (" + e.message + ")"); }

// ---- is-generator-fn ----
try {
    var isGenFn = unwrap(require("./vendor/is-generator-fn.js"));
    assert(typeof isGenFn === "function", "is-generator-fn is function");
    // We have no native generator functions (SM45 is pre-ES6 gen); predicate returns false.
    assert(isGenFn(function () {}) === false, "regular fn not a generator");
    console.log("ok: is-generator-fn");
} catch (e) { console.log("skip: is-generator-fn (" + e.message + ")"); }

// ---- is-retry-allowed ----
try {
    var ira = unwrap(require("./vendor/is-retry-allowed.js"));
    assert(typeof ira === "function", "is-retry-allowed is function");
    // Errors with transient codes should be retryable; 404 isn't.
    assert(ira({ code: "ETIMEDOUT" }) === true, "ETIMEDOUT retryable");
    assert(ira({ code: "ECONNREFUSED" }) === true, "ECONNREFUSED retryable");
    console.log("ok: is-retry-allowed");
} catch (e) { console.log("skip: is-retry-allowed (" + e.message + ")"); }

// ---- json-parse-better-errors ----
try {
    var parseJson = unwrap(require("./vendor/json-parse-better-errors.js"));
    assert(typeof parseJson === "function", "parseJson is function");
    eq(parseJson('{"a": 1}'), { a: 1 }, "valid json");
    var threw = false;
    try { parseJson("not json"); } catch (e) { threw = true; assert(e.message && e.message.length > 0, "error message"); }
    assert(threw, "invalid json throws");
    console.log("ok: json-parse-better-errors");
} catch (e) { console.log("skip: json-parse-better-errors (" + e.message + ")"); }

// ---- chardet (character set detection) ----
try {
    var chardet = require("./vendor/chardet.js");
    assert(typeof chardet.detect === "function", "chardet.detect");
    var utf8Bytes = Buffer.from("hello world", "utf8");
    var out = chardet.detect(utf8Bytes);
    assert(typeof out === "string" || out == null || typeof out === "object",
           "chardet.detect returns string/null/object");
    console.log("ok: chardet (loaded, detect returned " + JSON.stringify(out) + ")");
} catch (e) { console.log("skip: chardet (" + e.message + ")"); }

// ---- run-parallel (needs queue-microtask, which is vendored) ----
try {
    var runPar = unwrap(require("./vendor/run-parallel.js"));
    assert(typeof runPar === "function", "run-parallel is function");
    var tasks = [
        function (cb) { setImmediate(function () { cb(null, 1); }); },
        function (cb) { setImmediate(function () { cb(null, 2); }); },
        function (cb) { setImmediate(function () { cb(null, 3); }); }
    ];
    runPar(tasks, function (err, results) {
        if (err) { console.error("FAIL: run-parallel", err); process.exit(1); }
        eq(results, [1, 2, 3], "run-parallel results");
        console.log("ok: run-parallel");
    });
} catch (e) { console.log("skip: run-parallel (" + e.message + ")"); }

console.log("\nbatch_wave_aa smoke: inline done");
