#!/usr/bin/env node
// Run WPT subsets against ionpower-node. For each .any.js test file,
// spawns ./node wpt-harness.js <file>, captures stdout JSON lines,
// accumulates totals, writes per-category log + a TSV summary.
//
// Usage:
//     ./node scripts/conformance/run-wpt.js [category ...]
//         categories default to: encoding url streams WebCryptoAPI fetch/api
//
// Output:
//     docs/conformance/wpt-results/summary.tsv
//     docs/conformance/wpt-results/<category>.jsonl

var fs   = require("fs");
var path = require("path");
var cp   = require("child_process");

var ROOT     = path.resolve(__dirname, "..", "..");
var HARNESS  = path.join(ROOT, "scripts", "conformance", "wpt-harness.js");
var NODE_BIN = path.join(ROOT, "node");
var OUT_DIR  = path.join(ROOT, "docs", "conformance", "wpt-results");
var WPT_ROOT = path.join(ROOT, "external", "wpt");

if (!fs.existsSync(NODE_BIN)) {
    console.error("no ./node in " + ROOT + "; build first.");
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

var defaultCats = ["encoding", "url", "streams", "WebCryptoAPI", "fetch/api"];
var cats = process.argv.slice(2);
if (cats.length === 0) cats = defaultCats;

function findTests(dir) {
    var out = [];
    var ents;
    try { ents = fs.readdirSync(dir); } catch (e) { return out; }
    ents.sort();
    for (var i = 0; i < ents.length; i++) {
        var full = path.join(dir, ents[i]);
        var st;
        try { st = fs.statSync(full); } catch (e) { continue; }
        if (st.isDirectory()) {
            // Skip directories that obviously aren't tests.
            if (ents[i] === "resources" || ents[i] === "support") continue;
            out = out.concat(findTests(full));
        } else if (/\.any\.js$/.test(ents[i])) {
            out.push(full);
        }
    }
    return out;
}

var summaryPath = path.join(OUT_DIR, "summary.tsv");
fs.writeFileSync(summaryPath, "category\tfile\tpass\tfail\tskip\ttotal\ttime_ms\n");
function appendSummary(line) { fs.appendFileSync(summaryPath, line); }

var grandTotal = { pass: 0, fail: 0, skip: 0, files: 0, errors: 0 };

function runOne(file, cb) {
    var stdout = "";
    var killed = false;
    var done = false;
    var timer = null;

    var child = cp.spawn(NODE_BIN, [HARNESS, file], { stdio: ["ignore", "pipe", "ignore"] });
    timer = setTimeout(function () {
        killed = true;
        try { child.kill("SIGKILL"); } catch (e) {}
    }, 60000);

    child.stdout.on("data", function (chunk) {
        stdout += chunk.toString("utf8");
    });
    child.on("close", function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cb(null, { stdout: stdout, killed: killed });
    });
    child.on("error", function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cb(err);
    });
}

function processOne(category, file, next) {
    var rel = path.relative(ROOT, file);
    runOne(file, function (err, res) {
        var pass = 0, fail = 0, skip = 0, total = 0, ms = -1;
        var lines = (res && res.stdout || "").split("\n").filter(Boolean);
        var summary_seen = false;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            try {
                var obj = JSON.parse(line);
                if (obj.summary) {
                    pass = obj.summary.pass | 0;
                    fail = obj.summary.fail | 0;
                    skip = obj.summary.skip | 0;
                    total = obj.summary.total | 0;
                    ms = obj.summary.timeMs | 0;
                    summary_seen = true;
                }
            } catch (e) { /* not a JSON line */ }
        }
        if (!summary_seen) grandTotal.errors++;
        grandTotal.pass += pass; grandTotal.fail += fail; grandTotal.skip += skip;
        grandTotal.files++;

        // Write per-category JSONL.
        fs.appendFileSync(catLogs[category], (res && res.stdout) || "");
        // Mark a "fatal" line if no summary appeared.
        if (!summary_seen) {
            fs.appendFileSync(catLogs[category],
                JSON.stringify({ file: rel, fatal: true,
                                 message: res && res.killed ? "60s timeout" : (err && err.message) || "no summary"
                               }) + "\n");
        }
        appendSummary(category + "\t" + rel + "\t" + pass + "\t" + fail + "\t" +
            skip + "\t" + total + "\t" + ms + "\n");
        next();
    });
}

var catLogs = {};
function loop(catList, done) {
    if (catList.length === 0) return done();
    var category = catList.shift();
    var dir = path.join(WPT_ROOT, category);
    if (!fs.existsSync(dir)) {
        console.log("[" + category + "] no such dir, skipping");
        return loop(catList, done);
    }
    var safeName = category.replace(/\//g, "_");
    var logPath  = path.join(OUT_DIR, safeName + ".jsonl");
    fs.writeFileSync(logPath, "");
    catLogs[category] = logPath;
    var files = findTests(dir);
    console.log("[" + category + "] " + files.length + " test files");
    var i = 0;
    function next() {
        if (i >= files.length) {
            console.log("  done " + category);
            return loop(catList, done);
        }
        if (i % 5 === 0) {
            process.stdout.write("  [" + i + "/" + files.length + "]\r");
        }
        var file = files[i++];
        processOne(category, file, next);
    }
    next();
}

var startMs = Date.now();
loop(cats.slice(), function () {
    var elapsed = Math.round((Date.now() - startMs) / 1000);
    console.log("");
    console.log("=== summary ===");
    console.log("  files:  " + grandTotal.files + " (" + grandTotal.errors + " load/timeout errors)");
    console.log("  pass:   " + grandTotal.pass);
    console.log("  fail:   " + grandTotal.fail);
    console.log("  skip:   " + grandTotal.skip);
    console.log("  total:  " + (grandTotal.pass + grandTotal.fail + grandTotal.skip));
    console.log("  elapsed: " + elapsed + " s");
    console.log("");
    console.log("results: " + summaryPath);
    console.log("per-test detail: " + OUT_DIR + "/<category>.jsonl");
    process.exit(0);
});
