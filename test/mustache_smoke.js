// Smoke test: mustache (logic-less templates) on ionpower-node.
const Mustache = require("./vendor/mustache.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    if (got === want) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label +
                                    "\n  got:  " + JSON.stringify(got) +
                                    "\n  want: " + JSON.stringify(want)); }
}

// Basic interpolation with HTML-escape. Mustache escapes <, >, &, ', ",
// and / inside {{x}}; literal angle brackets outside pass through.
eq("interp + escape",
   Mustache.render("Hi {{name}}, {{body}}", { name: "alice", body: "<b>hi</b>" }),
   "Hi alice, &lt;b&gt;hi&lt;&#x2F;b&gt;");

// Unescaped triple-stash.
eq("triple-stash",
   Mustache.render("<p>{{{body}}}</p>", { body: "<b>hi</b>" }),
   "<p><b>hi</b></p>");

// Section with array.
eq("each section",
   Mustache.render("{{#items}}- {{.}}\n{{/items}}", { items: ["a", "b", "c"] }),
   "- a\n- b\n- c\n");

// Inverted section (falsy).
eq("inverted empty",
   Mustache.render("{{^items}}none{{/items}}", { items: [] }),
   "none");
eq("inverted missing",
   Mustache.render("{{^user}}anon{{/user}}", {}),
   "anon");

// Nested contexts.
eq("nested",
   Mustache.render("{{#u}}{{name}} ({{age}}){{/u}}", { u: { name: "bob", age: 30 }}),
   "bob (30)");

// Lambda.
eq("lambda",
   Mustache.render("{{#up}}hello{{/up}}", {
       up: function () { return function (txt, render) { return render(txt).toUpperCase(); }; }
   }),
   "HELLO");

// Partials.
var partials = { greeting: "Hi, {{name}}" };
eq("partials",
   Mustache.render("{{> greeting}}!", { name: "world" }, partials),
   "Hi, world!");

console.log("\nmustache smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
