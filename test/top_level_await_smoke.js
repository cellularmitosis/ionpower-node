// Top-level await: works for entry-point scripts (which don't need
// to export anything synchronously). Babel-on-parse-failure now
// detects top-level await errors and retries with an async-IIFE
// wrapper.

// This file itself is the smoke. The require() that loads it would
// already wrap it in the CJS function wrapper, so we test with a
// child script instead.

var fs   = require("fs");
var path = require("path");
var os   = require("os");
var child_process = require("child_process");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var scriptPath = path.join(os.tmpdir(), "ion-tla-test-" + process.pid + ".js");

// Top-level await + a fake async fn.
fs.writeFileSync(scriptPath,
    'function fakeAsync(n) { return new Promise(function (r) { setTimeout(function () { r(n * 2); }, 30); }); }\n' +
    'var doubled = await fakeAsync(21);\n' +
    'console.log("DOUBLED=" + doubled);\n');

var nodeBin = process.argv[0];
var r = child_process.spawnSync(nodeBin, [scriptPath], { encoding: "utf8" });

try {
    if (r.status !== 0) {
        console.error("script exit status:", r.status);
        console.error("stderr:", r.stderr);
        console.error("stdout:", r.stdout);
        process.exit(1);
    }
    assert(/DOUBLED=42/.test(r.stdout || ""),
           "top-level await child printed DOUBLED=42 (got " + JSON.stringify(r.stdout) + ")");
    console.log("ok: top-level await in entry-point script");
} finally {
    try { fs.unlinkSync(scriptPath); } catch (e) {}
}

// Also: top-level for-await-of
var script2 = path.join(os.tmpdir(), "ion-tla2-test-" + process.pid + ".js");
fs.writeFileSync(script2,
    'async function* gen() { yield 1; yield 2; yield 3; }\n' +
    'var sum = 0;\n' +
    'for await (var n of gen()) { sum += n; }\n' +
    'console.log("SUM=" + sum);\n');
var r2 = child_process.spawnSync(nodeBin, [script2], { encoding: "utf8" });
try {
    assert(r2.status === 0, "for-await-of script exited 0 (got " + r2.status + "); stderr: " + (r2.stderr || ""));
    assert(/SUM=6/.test(r2.stdout || ""),
           "for-await-of summed to 6 (got " + JSON.stringify(r2.stdout) + ")");
    console.log("ok: top-level for-await-of");
} finally {
    try { fs.unlinkSync(script2); } catch (e) {}
}

console.log("\ntop_level_await smoke: all assertions passed");
