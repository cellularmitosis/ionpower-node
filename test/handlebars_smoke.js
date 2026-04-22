// Smoke test: handlebars (template engine) on ionpower-node.
// Unlike marked/acorn, handlebars COMPILES TEMPLATES TO FUNCTIONS at
// runtime via `new Function(...)`. That stresses the JS engine's
// parser + JIT on user-supplied source, a different path from marked's
// regex-heavy workload.

const Handlebars = require("./vendor/handlebars.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// 1. Simple interpolation.
var tpl1 = Handlebars.compile("Hello, {{name}}!");
var out1 = tpl1({ name: "PowerPC" });
assert(out1 === "Hello, PowerPC!", "simple interpolation got: " + out1);
console.log("ok: simple interpolation ->", out1);

// 2. Block helper + each.
var tpl2 = Handlebars.compile(
    "{{#each items}}- {{this}}\n{{/each}}"
);
var out2 = tpl2({ items: ["alpha", "beta", "gamma"] });
assert(out2 === "- alpha\n- beta\n- gamma\n", "each block got: " + JSON.stringify(out2));
console.log("ok: each block ->", JSON.stringify(out2));

// 3. If-else.
var tpl3 = Handlebars.compile(
    "{{#if loggedIn}}welcome {{user}}{{else}}please sign in{{/if}}"
);
assert(tpl3({ loggedIn: true, user: "alice" }) === "welcome alice", "if-true");
assert(tpl3({ loggedIn: false }) === "please sign in", "if-false");
console.log("ok: if-else both branches");

// 4. Custom helper.
Handlebars.registerHelper("shout", function (s) { return s.toUpperCase() + "!!"; });
var tpl4 = Handlebars.compile("say {{shout word}}");
var out4 = tpl4({ word: "hello" });
assert(out4 === "say HELLO!!", "custom helper got: " + out4);
console.log("ok: custom helper ->", out4);

// 5. HTML escaping (default on).
var tpl5 = Handlebars.compile("<p>{{body}}</p>");
var out5 = tpl5({ body: "<script>alert(1)</script>" });
assert(out5.indexOf("&lt;script&gt;") >= 0, "html-escape got: " + out5);
console.log("ok: html escape ->", out5);

// 6. Triple-stash leaves raw HTML.
var tpl6 = Handlebars.compile("<p>{{{body}}}</p>");
var out6 = tpl6({ body: "<b>raw</b>" });
assert(out6 === "<p><b>raw</b></p>", "triple-stash raw got: " + out6);
console.log("ok: triple-stash raw ->", out6);

console.log("\nhandlebars smoke: all assertions passed");
console.log("version:", Handlebars.VERSION);
