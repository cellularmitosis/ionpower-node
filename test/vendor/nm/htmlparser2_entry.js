// Entry for htmlparser2 — lives inside test/vendor/nm/ so that
// require("htmlparser2") resolves via node_modules walk-up.

var htmlparser2 = require("htmlparser2");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head><title>Hi</title></head>",
    "<body>",
    "  <div class='main' id='root'>",
    "    <h1>Hello from htmlparser2</h1>",
    "    <p>Running on PowerPC <em>Tiger</em>.</p>",
    "    <ul><li>one</li><li>two</li></ul>",
    "  </div>",
    "</body>",
    "</html>"
].join("\n");

// 1. Low-level Parser: count events.
var events = { opentag: 0, closetag: 0, text: 0 };
var parser = new htmlparser2.Parser({
    onopentag: function (name) { events.opentag++; },
    onclosetag: function (name) { events.closetag++; },
    ontext: function (t) { if (t.trim()) events.text++; }
});
parser.write(html);
parser.end();

assert(events.opentag >= 8, "opentag count " + events.opentag);
assert(events.closetag >= 8, "closetag count " + events.closetag);
assert(events.text >= 3, "text count " + events.text);
console.log("ok: Parser event counts:", JSON.stringify(events));

// 2. DomHandler -> DOM tree via parseDocument (htmlparser2 v8 API).
var dom = htmlparser2.parseDocument(html);
assert(dom && dom.children && dom.children.length > 0, "dom has children");
console.log("ok: parseDocument produced a tree");

// 3. Find an element by id through a recursive walk.
function find(nodes, pred) {
    for (var i = 0; i < nodes.length; ++i) {
        var n = nodes[i];
        if (pred(n)) return n;
        if (n.children) {
            var found = find(n.children, pred);
            if (found) return found;
        }
    }
    return null;
}

var rootDiv = find(dom.children, function (n) {
    return n.type === "tag" && n.name === "div" && n.attribs && n.attribs.id === "root";
});
assert(rootDiv, "found #root div");
assert(rootDiv.attribs["class"] === "main", "class='main'");
console.log("ok: tree walk finds #root div.main");

// 4. Text extraction.
var textContent = (function collect(node) {
    var out = "";
    if (node.type === "text") return node.data;
    if (node.children) for (var i = 0; i < node.children.length; ++i) out += collect(node.children[i]);
    return out;
})({ children: dom.children });

assert(textContent.indexOf("Hello from htmlparser2") >= 0, "text has Hello...");
assert(textContent.indexOf("Tiger") >= 0, "text has Tiger");
console.log("ok: text extraction");

console.log("\nhtmlparser2 smoke: all assertions passed");
