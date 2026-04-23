// log-scan: a composition demo that exercises the new event loop,
// real streams, async fs, and crypto pieces added this session.
//
// What it does: scans an Apache-ish common-log-format file, groups
// requests by status-code class (2xx/3xx/4xx/5xx), computes a
// summary, and writes it both to stdout (colored) and to a sibling
// results.json file. If the log file is missing, a synthetic one
// is generated first — so the demo runs offline.
//
// Libraries chained:
//   stream.Transform (our real impl)   — line-by-line parser
//   split2                              — LF splitter over the input
//   fs (async)                          — read + write via callbacks
//   chalk                               — per-class coloring
//   pretty-ms                           — "scanned in Xms"
//   crypto.createHash('sha1')           — digest of the input for provenance
//   hash-sum                            — stable group-bucket IDs
//   text-table                          — aligned summary rows

var fs       = require("fs");
var path     = require("path");
var stream   = require("stream");
var crypto   = require("crypto");
var chalk    = require("../../test/vendor/chalk.js");
var split2   = require("../../test/vendor/split2.js");
var textTable = require("../../test/vendor/text-table.js");
var hashSum  = require("../../test/vendor/hash-sum.js");
var prettyMsMod = require("../../test/vendor/pretty-ms.js");
var prettyMs = prettyMsMod.default || prettyMsMod;

var logPath = process.argv[2] || path.join(__dirname, "access.log");
var outPath = path.join(__dirname, "results.json");

// Generate a synthetic log file on first run.
if (!fs.existsSync(logPath)) {
    console.log(chalk.dim("[log-scan]"), "generating synthetic log at", logPath);
    var lines = [];
    var paths = ["/", "/login", "/api/users", "/api/posts", "/static/app.js",
                 "/static/app.css", "/favicon.ico", "/admin", "/missing"];
    var statuses = [200, 200, 200, 200, 301, 304, 404, 500];
    var now = new Date();
    for (var i = 0; i < 100; ++i) {
        var host = "10.0.0." + ((i * 37) % 255);
        var p = paths[i % paths.length];
        var s = statuses[(i * 23) % statuses.length];
        var sz = 100 + ((i * 997) % 9000);
        var dateStr = now.toUTCString();
        lines.push(host + ' - - [' + dateStr + '] "GET ' + p + ' HTTP/1.1" ' + s + ' ' + sz);
    }
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
}

// Digest the input for provenance.
var raw = fs.readFileSync(logPath);
var sha1 = crypto.createHash("sha1").update(raw).digest("hex");

// Parse with split2 + Transform: LogLine -> {status, path, size}.
var t0 = Date.now();
var counts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
var totalBytes = 0;
var paths = {};

var LOG_RX = /^\S+\s+\S+\s+\S+\s+\[[^\]]+\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+)/;

var parser = new stream.Transform({
    transform: function (chunk, enc, cb) {
        var line = String(chunk);
        var m = LOG_RX.exec(line);
        if (m) {
            var status = +m[3];
            var size = +m[4];
            var path_ = m[2];
            totalBytes += size;
            if (status >= 200 && status < 300) counts["2xx"]++;
            else if (status >= 300 && status < 400) counts["3xx"]++;
            else if (status >= 400 && status < 500) counts["4xx"]++;
            else if (status >= 500) counts["5xx"]++;
            paths[path_] = (paths[path_] || 0) + 1;
        }
        cb();
    }
});
var finished = false;
parser.on("finish", function () { finished = true; });

// Feed the file text through split2 -> parser. We write directly
// (skipping a Readable source) because our pipe's auto-resume path
// re-fires 'data' on the source when a second listener attaches,
// which would double-count. Direct writes give stable ordering.
var splitter = split2();
splitter.on("data", function (line) { parser.write(line); });
splitter.on("end",  function () { parser.end(); });
splitter.write(String(raw));
splitter.end();

// After drain, write results.
process.on("exit", function () {
    var dur = Date.now() - t0;

    // Color by class.
    var colorFor = function (k) {
        if (k === "2xx") return chalk.green(k);
        if (k === "3xx") return chalk.cyan(k);
        if (k === "4xx") return chalk.yellow(k);
        if (k === "5xx") return chalk.red(k);
        return k;
    };

    var rows = [[chalk.bold("class"), chalk.bold("count"), chalk.bold("bucket")]];
    Object.keys(counts).sort().forEach(function (k) {
        if (counts[k] > 0) {
            rows.push([colorFor(k), String(counts[k]), chalk.dim(hashSum(k))]);
        }
    });
    console.log("\n" + chalk.bold("log-scan") + chalk.dim(" — " + sha1.slice(0, 10) + "..."));
    console.log(textTable(rows));
    console.log();
    console.log(chalk.dim("  total bytes:  "), totalBytes);
    console.log(chalk.dim("  unique paths: "), Object.keys(paths).length);
    console.log(chalk.dim("  scanned in:   "), prettyMs(dur || 1));
    console.log();

    // And write JSON sidecar via async fs.
    var payload = {
        source: { path: logPath, sha1: sha1, bytes: raw.length },
        counts: counts,
        totalBytes: totalBytes,
        uniquePaths: Object.keys(paths).length,
        durationMs: dur
    };
    fs.writeFile(outPath, JSON.stringify(payload, null, 2), function (err) {
        if (err) console.error("[log-scan] write failed:", err);
        else console.log(chalk.dim("  results written to:"), outPath);
    });
});
