// Smoke test: sax (streaming XML/HTML parser) on ionpower-node.
// Uses our 'stream' and 'string_decoder' core module shims to load.
var sax = require("./vendor/sax.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var parser = sax.parser(/* strict */ true);

var tagStack  = [];
var texts     = [];
var closedOk  = true;

parser.onopentag = function (node) {
    tagStack.push(node.name);
};
parser.onclosetag = function (name) {
    if (tagStack.pop() !== name) closedOk = false;
};
parser.ontext = function (t) { if (t.trim()) texts.push(t.trim()); };
parser.onend = function () {
    console.log("parse ended, stack length:", tagStack.length);
};

var xml = [
    "<feed>",
    "  <entry>",
    "    <title>Hello, PPC</title>",
    "    <body>Some text</body>",
    "  </entry>",
    "  <entry>",
    "    <title>Another</title>",
    "  </entry>",
    "</feed>"
].join("\n");

parser.write(xml).close();

assert(tagStack.length === 0, "all tags closed");
assert(closedOk, "tag names balanced");
assert(texts.indexOf("Hello, PPC") >= 0, "saw 'Hello, PPC'");
assert(texts.indexOf("Another")    >= 0, "saw 'Another'");
console.log("ok: parsed atom-like feed (" + texts.length + " text nodes)");

console.log("\nsax smoke: all assertions passed");
