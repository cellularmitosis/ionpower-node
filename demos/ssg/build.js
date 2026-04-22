// Minimal static site generator.
//
// Reads input/*.md, extracts an optional title from the first
// `# Heading` line, renders body markdown through marked, wraps in
// a handlebars template, writes to output/<name>.html.
//
// Exercises: require, fs read/write/readdir/statSync/existsSync,
// path manipulation, marked, handlebars. All synchronous. No
// event loop needed.

const fs         = require("fs");
const path       = require("path");
const marked     = require("../../test/vendor/marked.js");
const Handlebars = require("../../test/vendor/handlebars.js");

var root     = path.dirname(process.argv[1]);
var inputDir = path.join(root, "input");
var outDir   = path.join(root, "output");
var tplPath  = path.join(root, "template.hbs");

if (!fs.existsSync(outDir)) {
    // fs.mkdirSync isn't in our bridge; fall back to system mkdir via
    // process.env.SHELL... no, just require the dir already exists from
    // checkout. The repo ships output/ pre-created.
    console.error("output directory missing:", outDir);
    process.exit(2);
}

var tpl = Handlebars.compile(fs.readFileSync(tplPath, "utf8"));
console.log("template loaded:", tplPath);

var entries = fs.readdirSync(inputDir).filter(function (n) {
    return n.slice(-3) === ".md";
}).sort();
console.log("input files:", entries.length);

var totalStart = Date.now();
var bytesIn  = 0;
var bytesOut = 0;

entries.forEach(function (name) {
    var srcPath = path.join(inputDir, name);
    var src = fs.readFileSync(srcPath, "utf8");
    bytesIn += src.length;

    // Very permissive frontmatter: look for a first-line "# Title".
    var title = null;
    var firstHash = src.match(/^#\s+(.+)$/m);
    if (firstHash) title = firstHash[1];

    var body = marked.parse(src);
    var html = tpl({ title: title || name, body: body, source: name });
    bytesOut += html.length;

    var outName = name.slice(0, -3) + ".html";
    var outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, html);
    console.log("  " + name + " -> " + outName +
                " (" + src.length + " md / " + html.length + " html)");
});

var elapsed = Date.now() - totalStart;
console.log(
    "\nbuilt " + entries.length + " pages in " + elapsed + " ms" +
    " (" + bytesIn + " in, " + bytesOut + " out)"
);
