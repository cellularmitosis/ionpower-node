// Benchmark: render a large synthetic markdown document through marked
// and time it. Useful as a JIT workout — marked is 99% regex and state-
// machine work, which is IonPower's bread and butter.

const fs     = require("fs");
const marked = require("./vendor/marked.js");

// Build a document with many of each construct, so the parser has to
// hit every branch. Roughly 15 KB of markdown.
const chunks = [];
chunks.push("# ionpower-node marked benchmark");
chunks.push("");
chunks.push("A benchmark document exercising headings, paragraphs, lists,");
chunks.push("blockquotes, inline code, code fences, links, and emphasis.");
chunks.push("");
for (let i = 0; i < 40; ++i) {
    chunks.push("## Section " + i);
    chunks.push("");
    chunks.push("Paragraph with *italic*, **bold**, `code`, and a [link](https://example.com/" + i + ").");
    chunks.push("");
    chunks.push("- item a" + i);
    chunks.push("- item b" + i);
    chunks.push("- item c" + i);
    chunks.push("");
    chunks.push("> Blockquote in section " + i + ".");
    chunks.push("> Second line of quote.");
    chunks.push("");
    chunks.push("```js");
    chunks.push("function section" + i + "(){ return " + i + "; }");
    chunks.push("```");
    chunks.push("");
}
const md = chunks.join("\n");

console.log("input: " + md.length + " bytes of markdown");

// Warmup so Ion kicks in.
for (let w = 0; w < 3; ++w) marked.parse(md);

// Timed run.
const N = 10;
const t0 = Date.now();
let bytes = 0;
for (let i = 0; i < N; ++i) {
    bytes += marked.parse(md).length;
}
const elapsed = Date.now() - t0;

console.log("passes:   " + N);
console.log("html out: " + (bytes / N | 0) + " bytes (per pass)");
console.log("elapsed:  " + elapsed + " ms");
console.log("per-pass: " + (elapsed / N).toFixed(2) + " ms");
console.log("throughput: " +
    ((md.length * N) / (elapsed / 1000) / 1024 / 1024).toFixed(2) +
    " MiB/s of markdown");
