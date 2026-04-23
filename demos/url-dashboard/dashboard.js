// url-dashboard: take a list of URLs, parse each with the URL
// polyfill, bucket by host, and render a colorized boxed table.
//
// Chains eight vendored libraries end-to-end:
//   URL (built-in polyfill)     parse each URL into components
//   sort-keys                   deterministic per-host iteration
//   chalk                       per-column color
//   string-width + strip-ansi   accurate width for alignment
//   text-table                  ASCII-table rendering
//   boxen                       framed output
//   hash-sum                    stable hash per host, used as a
//                               sort-break to demonstrate hash-sum
//   pretty-ms                   "parse took Xms"
//
// Usage:
//   ./node demos/url-dashboard/dashboard.js
//   ./node demos/url-dashboard/dashboard.js <url> [<url> ...]

var sortKeys  = require("../../test/vendor/sort-keys.js");
var chalk     = require("../../test/vendor/chalk.js");
var sw        = require("../../test/vendor/string-width.js");
var stripAnsi = require("../../test/vendor/strip-ansi.js");
var textTable = require("../../test/vendor/text-table.js");
var hashSum   = require("../../test/vendor/hash-sum.js");
var prettyMsMod = require("../../test/vendor/pretty-ms.js");
var prettyMs = prettyMsMod.default || prettyMsMod;

// Default corpus of URLs if none passed on argv.
var defaultUrls = [
    "https://example.com/",
    "https://example.com/a/b?q=1",
    "https://docs.example.com:8443/api/v1/users?page=2",
    "http://legacy.example.org/old/path#deprecated",
    "https://cdn.example.com/static/app.js",
    "https://cdn.example.com/static/app.css",
    "https://search.example.io/?q=ionpower&lang=en",
    "ftp://files.example.com/pub/README",
    "https://docs.example.com:8443/api/v1/posts?page=1",
    "https://example.com/login",
];

var argv = process.argv.slice(2);
var urls = argv.length ? argv : defaultUrls;

// --- parse + bucket -------------------------------------------------------

var t0 = Date.now();
var byHost = {};
urls.forEach(function (raw) {
    var u;
    try { u = new URL(raw); }
    catch (e) {
        console.error(chalk.red("skip:"), raw, "-", e.message);
        return;
    }
    var host = u.host || "(none)";
    if (!byHost[host]) byHost[host] = { host: host, paths: [] };
    byHost[host].paths.push({
        path: u.pathname,
        search: u.search,
        hash: u.hash,
        scheme: u.protocol.replace(/:$/, ""),
    });
});
var parseMs = Date.now() - t0;

// --- render ----------------------------------------------------------------

var sorted = sortKeys(byHost);
var hosts  = Object.keys(sorted);

var header = [
    chalk.bold.cyan("host"),
    chalk.bold.cyan("n"),
    chalk.bold.cyan("hash"),
    chalk.bold.cyan("sample path"),
];
var rows = [header];

hosts.forEach(function (h) {
    var entry = sorted[h];
    var sample = entry.paths[0];
    rows.push([
        chalk.magenta(h),
        chalk.yellow(String(entry.paths.length)),
        chalk.gray(hashSum(h)),
        sample.scheme + " " + sample.path
            + (sample.search ? chalk.dim(sample.search) : "")
            + (sample.hash   ? chalk.dim(sample.hash)   : "")
    ]);
});

// text-table passes its stringLength to strip ANSI before measuring.
var tbl = textTable(rows, {
    stringLength: function (s) { return sw(stripAnsi(String(s))); }
});

// Render our own rounded-corner box around the table. (Boxen works
// fine on plain-text input, but our colored table triggers its
// wrap-ansi path, whose regex uses ES2018 named capture groups
// SM45 can't parse. Simpler to just draw the frame ourselves and
// keep the colors end-to-end.)
function boxAround(text) {
    var tLines = text.split("\n");
    var w = 0;
    tLines.forEach(function (L) {
        var lw = sw(stripAnsi(L));
        if (lw > w) w = lw;
    });
    var top    = "+" + "-".repeat(w + 2) + "+";
    var bottom = "+" + "-".repeat(w + 2) + "+";
    var body = tLines.map(function (L) {
        var lw = sw(stripAnsi(L));
        return "| " + L + " ".repeat(w - lw) + " |";
    });
    return [top].concat(body).concat([bottom]).join("\n");
}

var boxed = boxAround(tbl);

console.log(boxed);
console.log(chalk.dim(
    "parsed " + urls.length + " URLs (" + hosts.length + " unique hosts) in "
    + prettyMs(parseMs || 1)
));
