// xmldoc + sax: parse a small XML document using the pure-JS sax
// parser (no stream API needed) wrapped in xmldoc's tree interface.

var xmldoc = require("./vendor/xmldoc.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var doc = new xmldoc.XmlDocument(
    "<?xml version=\"1.0\"?>\n" +
    "<rss version=\"2.0\">\n" +
    "  <channel>\n" +
    "    <title>ionpower-node</title>\n" +
    "    <item><title>Hello</title><guid>1</guid></item>\n" +
    "    <item><title>World</title><guid>2</guid></item>\n" +
    "  </channel>\n" +
    "</rss>\n");

assert(doc.name === "rss", "root element name rss: " + doc.name);
assert(doc.attr.version === "2.0", "rss version attr: " + doc.attr.version);

var channel = doc.childNamed("channel");
assert(channel !== undefined, "channel element found");

var title = channel.childNamed("title");
assert(title && title.val === "ionpower-node", "title val");

var items = channel.childrenNamed("item");
assert(items.length === 2, "2 items: got " + items.length);
assert(items[0].childNamed("title").val === "Hello", "item0.title");
assert(items[1].childNamed("guid").val  === "2",     "item1.guid");

console.log("ok: xmldoc parsed RSS (2 items)");
console.log("\nxmldoc smoke: all assertions passed");
