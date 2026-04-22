// Smoke test: EJS (Embedded JavaScript templates) on ionpower-node.
var ejs = require("./vendor/ejs.js");

function eq(label, got, want) {
    if (got === want) console.log("ok: " + label);
    else { console.error("FAIL: " + label + "\n  got:  " + JSON.stringify(got) +
                                        "\n  want: " + JSON.stringify(want)); process.exit(1); }
}

// Simple interpolation.
eq("interp", ejs.render("Hello <%= name %>!", { name: "PPC" }), "Hello PPC!");

// HTML escape.
eq("escape",
   ejs.render("<p><%= body %></p>", { body: "<script>" }),
   "<p>&lt;script&gt;</p>");

// Unescaped.
eq("raw",
   ejs.render("<p><%- body %></p>", { body: "<b>raw</b>" }),
   "<p><b>raw</b></p>");

// Control flow.
eq("if-else",
   ejs.render("<% if (n > 0) { %>pos<% } else { %>neg<% } %>", { n: 5 }),
   "pos");

// Loops.
eq("each",
   ejs.render("<% for (var i = 0; i < items.length; i++) { %>- <%= items[i] %>\n<% } %>",
              { items: ["a", "b", "c"] }),
   "- a\n- b\n- c\n");

// Compile then reuse.
var tpl = ejs.compile("<%= greeting %>, <%= who %>!");
eq("compile+reuse A", tpl({ greeting: "Hi", who: "G5" }), "Hi, G5!");
eq("compile+reuse B", tpl({ greeting: "Hey", who: "G3" }), "Hey, G3!");

console.log("\nejs smoke: all assertions passed");
