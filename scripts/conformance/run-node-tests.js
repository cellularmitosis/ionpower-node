#!/usr/bin/env node
// Run Node parallel-test subsets against ionpower-node. For each
// test/parallel/test-<topic>-*.js file:
//   1. Spawn ./node <test-file> with our common.js shim swapped in
//   2. Capture exit code + stderr
//   3. Classify: pass (exit 0) | skip (1..0 marker) | fail (non-zero)
//
// Usage:
//     ./node scripts/conformance/run-node-tests.js [topic ...]
//         topics default to: buffer path querystring url events stream
//                            crypto zlib fs string-decoder assert
//
// Output:
//     docs/conformance/node-results/summary.tsv
//     docs/conformance/node-results/<topic>.jsonl

var fs   = require("fs");
var path = require("path");
var cp   = require("child_process");

var ROOT     = path.resolve(__dirname, "..", "..");
var NODE_BIN = path.join(ROOT, "node");
var OUT_DIR  = path.join(ROOT, "docs", "conformance", "node-results");
var TEST_ROOT = path.join(ROOT, "external", "node-tests", "test");
var COMMON_DIR = path.join(TEST_ROOT, "common");
var COMMON_INDEX = path.join(COMMON_DIR, "index.js");
var COMMON_SHIM = path.join(ROOT, "scripts", "conformance", "node-common-shim.js");

if (!fs.existsSync(NODE_BIN)) {
    console.error("no ./node in " + ROOT + "; build first.");
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Swap common shim in.
var orig = COMMON_INDEX + ".orig";
if (!fs.existsSync(orig)) {
    fs.renameSync(COMMON_INDEX, orig);
}
fs.writeFileSync(COMMON_INDEX, fs.readFileSync(COMMON_SHIM, "utf8"));

var defaultTopics = ["assert", "buffer", "path", "querystring", "url",
                     "events", "stream", "string-decoder", "fs", "zlib", "crypto"];
var topics = process.argv.slice(2);
if (topics.length === 0) topics = defaultTopics;

var summaryPath = path.join(OUT_DIR, "summary.tsv");
// Resume support: if summary.tsv exists, parse it for already-recorded
// files and skip them. Otherwise start fresh.
var alreadyDone = {};
if (fs.existsSync(summaryPath)) {
    var existing = fs.readFileSync(summaryPath, "utf8").split("\n");
    for (var i = 1; i < existing.length; i++) {
        var cols = existing[i].split("\t");
        if (cols[1]) alreadyDone[cols[1]] = true;
    }
    console.log("resume: " + Object.keys(alreadyDone).length + " files already in summary, will skip");
} else {
    fs.writeFileSync(summaryPath, "topic\tfile\tresult\texit\ttime_ms\tmessage\n");
}

var grandTotal = { pass: 0, fail: 0, skip: 0, error: 0, files: 0 };

function runOne(file, cb) {
    var t0 = Date.now();
    var stderr = "";
    var stdout = "";
    var killed = false;
    var done = false;
    var child = cp.spawn(NODE_BIN, [file], { stdio: ["ignore", "pipe", "pipe"] });

    function finish(code) {
        if (done) return; done = true;
        clearTimeout(softTimer);
        clearTimeout(hardTimer);
        cb(null, { code: code, stdout: stdout, stderr: stderr,
                   killed: killed, ms: Date.now() - t0 });
    }

    // Soft timeout: try SIGKILL, expect 'close' to follow within 5 s.
    var softTimer = setTimeout(function () {
        killed = true;
        try { child.kill("SIGKILL"); } catch (e) {}
    }, 30000);

    // Hard timeout: if 'close' STILL hasn't fired after another 10 s
    // (e.g., the test forked a child that's holding stdio open), give
    // up on the close event and report fail. Detach our pipes so they
    // don't keep us alive.
    var hardTimer = setTimeout(function () {
        try { child.stdout.destroy(); } catch (e) {}
        try { child.stderr.destroy(); } catch (e) {}
        try { child.unref(); } catch (e) {}
        killed = true;
        finish(-1);  // synthetic non-zero
    }, 40000);

    child.stdout.on("data", function (c) { stdout += c.toString("utf8"); });
    child.stderr.on("data", function (c) { stderr += c.toString("utf8"); });
    child.on("close", function (code) { finish(code); });
    child.on("error", function (err) {
        if (done) return; done = true;
        clearTimeout(softTimer);
        clearTimeout(hardTimer);
        cb(err);
    });
}

function classify(res) {
    if (res.killed) return { result: "timeout", message: "30s timeout" };
    // SKIP marker (TAP).
    if (/^1\.\.0\b/m.test(res.stdout)) return { result: "skip", message: "" };
    if (res.code === 0) return { result: "pass", message: "" };
    // First few stderr/stdout lines as the message.
    var msg = (res.stderr || res.stdout || "")
        .split("\n").filter(Boolean).slice(0, 3).join(" | ").slice(0, 240);
    return { result: "fail", message: msg };
}

function processOne(topic, file, next) {
    var rel = path.relative(ROOT, file);
    if (alreadyDone[rel]) { next(); return; }
    runOne(file, function (err, res) {
        var info, line;
        if (err) {
            info = { result: "error", message: err.message };
            grandTotal.error++;
        } else {
            info = classify(res);
            grandTotal[info.result === "timeout" ? "fail" :
                       info.result === "error" ? "error" :
                       info.result]++;
        }
        grandTotal.files++;
        line = topic + "\t" + rel + "\t" + info.result + "\t" +
               (res ? res.code : "-") + "\t" +
               (res ? res.ms : 0) + "\t" +
               (info.message || "").replace(/[\r\n\t]/g, " ") + "\n";
        fs.appendFileSync(summaryPath, line);
        // Per-test detail JSONL.
        fs.appendFileSync(path.join(OUT_DIR, topic + ".jsonl"),
            JSON.stringify({
                file: rel, result: info.result,
                exit: res && res.code, ms: res && res.ms,
                stderr: (res && res.stderr || "").slice(0, 1000),
                stdout: (res && res.stdout || "").slice(0, 500)
            }) + "\n");
        next();
    });
}

function listTests(topic) {
    var dir = path.join(TEST_ROOT, "parallel");
    var prefix = "test-" + topic + "-";
    var ents;
    try { ents = fs.readdirSync(dir); } catch (e) { return []; }
    return ents.filter(function (n) {
        return n.indexOf(prefix) === 0 && /\.js$/.test(n) && !/\.deflaked/.test(n);
    }).sort().map(function (n) { return path.join(dir, n); });
}

function loop(topicList, done) {
    if (topicList.length === 0) return done();
    var topic = topicList.shift();
    var files = listTests(topic);
    if (files.length === 0) {
        console.log("[" + topic + "] no test files matched");
        return loop(topicList, done);
    }
    fs.writeFileSync(path.join(OUT_DIR, topic + ".jsonl"), "");
    console.log("[" + topic + "] " + files.length + " test files");
    var i = 0;
    function next() {
        if (i >= files.length) {
            console.log("  done " + topic);
            return loop(topicList, done);
        }
        if (i % 5 === 0) {
            process.stdout.write("  [" + i + "/" + files.length + "]\r");
        }
        processOne(topic, files[i++], next);
    }
    next();
}

var startMs = Date.now();
loop(topics.slice(), function () {
    var elapsed = Math.round((Date.now() - startMs) / 1000);
    // Restore the original common/index.js.
    if (fs.existsSync(orig)) {
        fs.unlinkSync(COMMON_INDEX);
        fs.renameSync(orig, COMMON_INDEX);
    }
    console.log("");
    console.log("=== summary ===");
    console.log("  files:  " + grandTotal.files);
    console.log("  pass:   " + grandTotal.pass);
    console.log("  fail:   " + grandTotal.fail);
    console.log("  skip:   " + grandTotal.skip);
    console.log("  error:  " + grandTotal.error);
    console.log("  pct:    " + (grandTotal.files
        ? Math.round(100 * grandTotal.pass / grandTotal.files)
        : 0) + "%");
    console.log("  elapsed: " + elapsed + " s");
    console.log("");
    console.log("results: " + summaryPath);
    process.exit(0);
});
