// Static site generator v2.
//
// Reads input/*.md, optional YAML front-matter at the top of each
// file becomes template locals, the rest runs through markdown-it
// with a Prism-based code-fence highlighter, and handlebars wraps
// it in the layout. Output goes to output/<slug>.html, with the slug
// derived via slugify.
//
// Exercises, end-to-end on ionpower-node:
//   * fs (readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync)
//   * path.join / dirname
//   * js-yaml (frontmatter)
//   * markdown-it (body render)
//   * prism (syntax highlighting inside code fences)
//   * handlebars (layout template)
//   * slugify (URL-safe filename from title)

const fs         = require("fs");
const path       = require("path");
const yaml       = require("../../test/vendor/js-yaml.js");
const MarkdownIt = require("../../test/vendor/markdown-it.js");
const Prism      = require("../../test/vendor/prism.js");
const Handlebars = require("../../test/vendor/handlebars.js");
const slugify    = require("../../test/vendor/slugify.js");

var root     = path.dirname(process.argv[1]);
var inputDir = path.join(root, "input");
var outDir   = path.join(root, "output");
var tplPath  = path.join(root, "template.hbs");

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log("created:", outDir);
}

// Markdown-it with Prism highlighter for code fences.
var md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: function (code, lang) {
        if (lang && Prism.languages[lang]) {
            try {
                return '<pre class="language-' + lang + '"><code>'
                     + Prism.highlight(code, Prism.languages[lang], lang)
                     + '</code></pre>';
            } catch (e) { /* fall through */ }
        }
        // No language or unknown language: let markdown-it's default kick in.
        return '';
    }
});

var tpl = Handlebars.compile(fs.readFileSync(tplPath, "utf8"));
console.log("template loaded:", tplPath);

// Split YAML frontmatter from body.
function splitFrontmatter(src) {
    if (src.slice(0, 4) !== "---\n") return { frontmatter: {}, body: src };
    var end = src.indexOf("\n---\n", 4);
    if (end < 0) return { frontmatter: {}, body: src };
    var yamlSrc = src.slice(4, end);
    var body    = src.slice(end + 5);
    try {
        return { frontmatter: yaml.load(yamlSrc) || {}, body: body };
    } catch (e) {
        console.warn("yaml parse failed:", e.message);
        return { frontmatter: {}, body: body };
    }
}

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

    var parts = splitFrontmatter(src);
    var fm    = parts.frontmatter;
    var body  = md.render(parts.body);

    // Title from frontmatter, else first markdown heading, else filename.
    var title = fm.title;
    if (!title) {
        var firstHash = parts.body.match(/^#\s+(.+)$/m);
        title = firstHash ? firstHash[1] : name;
    }

    // Slug from title.
    var slug = slugify(String(title), { lower: true, strict: true });
    if (!slug) slug = name.slice(0, -3);

    var html = tpl({
        title: title,
        body:  body,
        source: name,
        author: fm.author || "anonymous hacker",
        date:   fm.date || ""
    });
    bytesOut += html.length;

    var outName = slug + ".html";
    var outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, html);
    console.log("  " + name + " -> " + outName +
                " (" + src.length + " md / " + html.length + " html" +
                (fm.title ? ", fm" : "") + ")");
});

var elapsed = Date.now() - totalStart;
console.log(
    "\nbuilt " + entries.length + " pages in " + elapsed + " ms" +
    " (" + bytesIn + " in, " + bytesOut + " out)"
);
console.log("libs used: marked? no -> markdown-it+prism+yaml+slugify+handlebars+fs+path");
