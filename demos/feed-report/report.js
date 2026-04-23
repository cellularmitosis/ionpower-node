// feed-report: composition demo for ionpower-node.
//
// Reads an RSS 2.0 feed and prints a colorized, aligned summary.
// Uses six community libraries wired through our Node-compat layer:
//   xmldoc          — parse the XML tree (via the sax pure-JS parser)
//   ansi-styles     — raw SGR codes for colored output
//   strip-ansi      — strip SGR when measuring widths
//   string-width    — measure the rendered cell width of a string
//   color-hash      — stable color per author (keeps the hue consistent
//                     across runs without hardcoding a palette)
//   pretty-ms       — format "age" as 1.5h / 2d / 3h5m
//
// Usage:
//   ./node demos/feed-report/report.js demos/feed-report/sample.xml

var fs       = require("fs");
var xmldoc   = require("../../test/vendor/xmldoc.js");
var styles   = require("../../test/vendor/ansi-styles.js");
var stripAnsi= require("../../test/vendor/strip-ansi.js");
var sw       = require("../../test/vendor/string-width.js");
var CH_MOD   = require("../../test/vendor/color-hash.js");
var prettyMsMod = require("../../test/vendor/pretty-ms.js");
var prettyMs = prettyMsMod.default || prettyMsMod;

var ColorHash = CH_MOD.default || CH_MOD["default"] || CH_MOD.ColorHash || CH_MOD;
if (typeof ColorHash !== "function") ColorHash = CH_MOD.ColorHash;
var ch = new ColorHash();

// ---------- tiny color helpers -----------------------------------------

function rgbFg(r, g, b) { return "\u001B[38;2;" + r + ";" + g + ";" + b + "m"; }
var RESET = "\u001B[0m";

function authorColor(name) {
    // color-hash returns [r, g, b] in 0..255.
    var rgb = ch.rgb(name);
    return rgbFg(rgb[0] | 0, rgb[1] | 0, rgb[2] | 0) + name + RESET;
}

// ---------- argv -------------------------------------------------------

var xmlPath = process.argv[2] || __dirname + "/sample.xml";
var xml;
try {
    xml = fs.readFileSync(xmlPath, "utf8");
} catch (e) {
    console.error(styles.red.open + "FAIL:" + styles.red.close, "cannot read", xmlPath);
    process.exit(1);
}

// ---------- parse ------------------------------------------------------

var doc = new xmldoc.XmlDocument(xml);
var channel = doc.childNamed("channel");
if (!channel) {
    console.error("not a valid RSS document");
    process.exit(1);
}
var feedTitle = channel.childNamed("title") ? channel.childNamed("title").val : "(untitled)";
var items = channel.childrenNamed("item");

// ---------- layout -----------------------------------------------------

// Section header.
var H = styles.bold.open + styles.cyan.open;
var DIM = styles.gray && styles.gray.open ? styles.gray.open : "";
var RX = styles.reset.open;

console.log("");
console.log(H + "== " + feedTitle + " ==" + RX);
console.log(DIM + items.length + " item" + (items.length === 1 ? "" : "s") + " - parsed via xmldoc + sax" + RX);
console.log("");

// Precompute the widest "[n]" gutter so everything aligns.
var gutterCells = String("[" + items.length + "]").length;

// Assume "now" is the latest pubDate (keeps the demo offline-friendly).
var pubs = items.map(function (it) {
    var d = it.childNamed("pubDate");
    return d ? Date.parse(d.val) : NaN;
}).filter(function (n) { return !isNaN(n); });
var now = pubs.length ? Math.max.apply(null, pubs) : Date.now();

items.forEach(function (item, i) {
    var title   = (item.childNamed("title")  || {}).val  || "(untitled)";
    var author  = (item.childNamed("author") || {}).val  || "anonymous";
    var pubStr  = (item.childNamed("pubDate")|| {}).val  || null;
    var descrip = (item.childNamed("description") || {}).val || "";
    var when    = pubStr ? Date.parse(pubStr) : null;
    var ageMs   = (when && !isNaN(when)) ? (now - when) : null;

    var gut = "[" + (i + 1) + "]";
    var gutPad = "";
    while (sw(stripAnsi(gutPad + gut)) < gutterCells) gutPad += " ";

    var ageStr = ageMs == null ? "(?)" :
                 ageMs === 0   ? "just now"  :
                                 prettyMs(ageMs, { compact: true }) + " ago";

    // Title line: "[n] TITLE"
    console.log(
        styles.yellow.open + gutPad + gut + RX +
        " " + styles.bold.open + title + RX
    );
    // Meta line: by AUTHOR - AGE
    console.log(
        "  " +
        DIM + "by " + RX + authorColor(author) +
        " " + DIM + "- " + ageStr + RX
    );
    if (descrip) {
        // Wrap descrip at ~78 cols using string-width so non-ASCII aligns.
        var words = descrip.split(/\s+/);
        var line = "  " + DIM;
        for (var w = 0; w < words.length; w++) {
            var cand = (line === "  " + DIM ? line + words[w] : line + " " + words[w]);
            if (sw(stripAnsi(cand)) > 78) {
                console.log(line + RX);
                line = "  " + DIM + words[w];
            } else {
                line = cand;
            }
        }
        if (line.length) console.log(line + RX);
    }
    console.log("");
});

// Closing line.
console.log(DIM + "-- end of feed --" + RX);
