// Demo: fetch a GitHub README over HTTPS and render it to HTML.
// Exercises http.getSync, markdown-it, JSON parsing, cache-to-disk.
//
// Usage:   node demos/http-fetch/fetch-and-render.js [repo]
// Example: node demos/http-fetch/fetch-and-render.js classilla/tenfourfox

var http       = require("http");
var fs         = require("fs");
var path       = require("path");
var MarkdownIt = require("../../test/vendor/markdown-it.js");

var repo = process.argv[2] || "classilla/tenfourfox";
var cachePath = path.join(process.cwd(), ".fetch-cache-" + repo.replace(/\//g, "_") + ".json");

function fetchJSON(url) {
    var r = http.getSync(url);
    if (r.status !== 200) {
        throw new Error("HTTP " + r.status + " fetching " + url);
    }
    return JSON.parse(r.body);
}

// Use the GitHub API to locate the README. Falls back to raw.githubusercontent.com.
var t0 = Date.now();
var readmeText;
if (fs.existsSync(cachePath)) {
    console.log("(cache) reading", cachePath);
    readmeText = fs.readFileSync(cachePath, "utf8");
} else {
    console.log("fetching README for", repo);
    // The /readme endpoint returns { content, encoding: 'base64', ... }.
    var meta = fetchJSON("https://api.github.com/repos/" + repo + "/readme");
    // content is base64 with \n every 60 chars.
    var b64 = String(meta.content || "").replace(/\n/g, "");
    readmeText = Buffer.from(b64, "base64").toString("utf8");
    fs.writeFileSync(cachePath, readmeText);
    console.log("  cached " + readmeText.length + " bytes to", cachePath);
}
var fetchMs = Date.now() - t0;

// Render with markdown-it.
var md = new MarkdownIt({ html: true, linkify: true });
t0 = Date.now();
var html = md.render(readmeText);
var renderMs = Date.now() - t0;

// Emit a minimal HTML page.
var outPath = path.join(process.cwd(), "readme-" + repo.replace(/\//g, "_") + ".html");
var page = [
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>",
    repo,
    " README</title></head><body>",
    html,
    "<hr><footer>fetched+rendered by ionpower-node on PowerPC Tiger; ",
    "fetch " + fetchMs + " ms, render " + renderMs + " ms",
    "</footer></body></html>"
].join("");
fs.writeFileSync(outPath, page);

console.log("");
console.log("input README:", readmeText.length, "bytes (" + fetchMs + " ms)");
console.log("output HTML: ", page.length, "bytes (" + renderMs + " ms)");
console.log("wrote:       ", outPath);
