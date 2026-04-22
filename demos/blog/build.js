// Blog builder on top of the ssg v2 pipeline.
//
// Recursively walks input/**/*.md, parses YAML frontmatter, renders
// markdown body through markdown-it (+ prism syntax highlighting),
// handlebars for the post and index layouts, slugify for URL-safe
// filenames, xml2js.Builder for rss.xml.
//
// Ordering: posts sorted by frontmatter date descending. Each post
// page gets a prev/next link to its date-adjacent neighbours.
//
// Uses the same vendored libraries as demos/ssg, reached via
// ../../test/vendor. The blog subdirectory structure mirrors the
// output structure — input/tech/foo.md -> output/tech/<slug>.html.
// Per-file timings printed so you can see which pages cost the most.

var fs         = require("fs");
var path       = require("path");
var yaml       = require("../../test/vendor/js-yaml.js");
var MarkdownIt = require("../../test/vendor/markdown-it.js");
var Prism      = require("../../test/vendor/prism.js");
var Handlebars = require("../../test/vendor/handlebars.js");
var slugify    = require("../../test/vendor/slugify.js");
var xml2js     = require("../../test/vendor/nm/node_modules/xml2js/lib/xml2js.js");

var root     = path.dirname(process.argv[1]);
var inputDir = path.join(root, "input");
var outDir   = path.join(root, "output");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.copyFileSync(path.join(root, "style.css"), path.join(outDir, "style.css"));

// Recursive .md walker. Returns [{ absPath, relPath, parentDir }].
function walk(dir, relFromInput) {
    var out = [];
    var entries = fs.readdirSync(dir);
    for (var i = 0; i < entries.length; ++i) {
        var name = entries[i];
        var abs  = path.join(dir, name);
        var rel  = relFromInput ? path.join(relFromInput, name) : name;
        var st   = fs.statSync(abs);
        if (st.isDirectory) {
            var sub = walk(abs, rel);
            for (var j = 0; j < sub.length; ++j) out.push(sub[j]);
        } else if (name.slice(-3) === ".md") {
            out.push({ abs: abs, rel: rel, parent: relFromInput || "" });
        }
    }
    return out;
}

function splitFrontmatter(src) {
    if (src.slice(0, 4) !== "---\n") return { fm: {}, body: src };
    var end = src.indexOf("\n---\n", 4);
    if (end < 0) return { fm: {}, body: src };
    var yamlSrc = src.slice(4, end);
    var body    = src.slice(end + 5);
    try { return { fm: yaml.load(yamlSrc) || {}, body: body }; }
    catch (e) {
        console.warn("yaml parse failed for chunk:", e.message);
        return { fm: {}, body: body };
    }
}

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
        return '';
    }
});

var postTpl  = Handlebars.compile(fs.readFileSync(path.join(root, "post.hbs"),  "utf8"));
var indexTpl = Handlebars.compile(fs.readFileSync(path.join(root, "index.hbs"), "utf8"));

var files = walk(inputDir, "");
console.log("input files:", files.length);

// First pass: parse each file, compute slug + output path, store
// frontmatter and rendered body. We need all files before we can
// fill in prev/next links.
var posts = [];
for (var i = 0; i < files.length; ++i) {
    var t0  = Date.now();
    var f   = files[i];
    var src = fs.readFileSync(f.abs, "utf8");
    var parts = splitFrontmatter(src);
    var fm   = parts.fm;
    var body = md.render(parts.body);

    var title = fm.title;
    if (!title) {
        var m = parts.body.match(/^#\s+(.+)$/m);
        title = m ? m[1] : f.rel;
    }
    var slug = slugify(String(title), { lower: true, strict: true });
    if (!slug) slug = f.rel.replace(/[\/\\]/g, "-").slice(0, -3);

    var relOut = f.parent ? path.join(f.parent, slug + ".html")
                          : slug + ".html";
    posts.push({
        title:   title,
        author:  fm.author || "",
        date:    fm.date || "",
        tags:    fm.tags || [],
        body:    body,
        source:  f.rel,
        relOut:  relOut,
        dirDepth: f.parent ? f.parent.split("/").length : 0,
        parseMs: Date.now() - t0
    });
}

// Sort posts by date descending (string compare on ISO dates works).
posts.sort(function (a, b) {
    var aa = String(a.date), bb = String(b.date);
    return bb < aa ? -1 : (bb > aa ? 1 : 0);
});

// Second pass: write each post with prev/next links.
var writeStart = Date.now();
var totalBytesIn  = 0;
var totalBytesOut = 0;

for (var i = 0; i < posts.length; ++i) {
    var p = posts[i];
    var outPath = path.join(outDir, p.relOut);
    var outSub  = path.dirname(outPath);
    if (!fs.existsSync(outSub)) fs.mkdirSync(outSub, { recursive: true });

    // prev = older; next = newer (by our descending sort).
    var prev = posts[i + 1];
    var next = posts[i - 1];
    function rel(target, src) {
        // Relative href from src's output dir to target's output dir.
        var srcDir   = path.dirname(src);
        var segments = srcDir === outDir ? "" : "../";
        return segments + target;
    }
    var t0 = Date.now();
    var html = postTpl({
        title:  p.title,
        author: p.author,
        date:   p.date,
        tags:   p.tags,
        body:   p.body,
        source: p.source,
        prev:   prev && { title: prev.title, href: rel(prev.relOut, outPath) },
        next:   next && { title: next.title, href: rel(next.relOut, outPath) }
    });
    fs.writeFileSync(outPath, html);
    var dt = Date.now() - t0;
    totalBytesIn  += p.body.length;
    totalBytesOut += html.length;
    console.log(
        "  " + p.source + "  -->  " + p.relOut +
        "  (parse " + p.parseMs + " ms, render+write " + dt + " ms)"
    );
}

// Index page.
var indexHtml = indexTpl({
    siteTitle:    "ionpower-node blog",
    siteSubtitle: "A blog rendered on a PowerPC G5 iMac running Mac OS X Tiger.",
    count:        posts.length,
    posts:        posts.map(function (p) {
        return {
            title:  p.title,
            href:   p.relOut,
            date:   p.date,
            author: p.author
        };
    })
});
fs.writeFileSync(path.join(outDir, "index.html"), indexHtml);
console.log("  (index)  -->  index.html");

// RSS via xml2js Builder.
var builder = new xml2js.Builder({ headless: false, rootName: "rss" });
var rssDoc = {
    $: { version: "2.0" },
    channel: {
        title:       "ionpower-node blog",
        link:        "https://example.invalid/",
        description: "Built on PowerPC Tiger.",
        item: posts.map(function (p) {
            return {
                title:       p.title,
                link:        "https://example.invalid/" + p.relOut,
                pubDate:     p.date ? new Date(p.date).toUTCString() : "",
                author:      p.author || "anonymous",
                description: p.body.slice(0, 400)
            };
        })
    }
};
var rssXml = builder.buildObject(rssDoc);
fs.writeFileSync(path.join(outDir, "rss.xml"), rssXml);
console.log("  (rss)    -->  rss.xml (" + rssXml.length + " bytes)");

var writeMs = Date.now() - writeStart;
console.log(
    "\nbuilt " + posts.length + " posts + index + rss in " +
    writeMs + " ms (" + totalBytesIn + " md in, " + totalBytesOut + " html out)"
);
