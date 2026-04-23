// simple-html-tokenizer: produce a token stream from HTML.

var tok = require("./vendor/simple-html-tokenizer.js");
var tokens = tok.tokenize("<p class=\"lead\">Hello <b>Tiger</b></p>");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(Array.isArray(tokens), "tokens array");
assert(tokens.length >= 6, "at least 6 tokens: " + tokens.length);

// Find first StartTag for <p> and check attrs.
var p = tokens.find(function (t) { return t.type === "StartTag" && t.tagName === "p"; });
assert(p, "found <p> start tag");
assert(p.attributes && p.attributes.length >= 1, "p has attrs");
assert(p.attributes[0][0] === "class" && p.attributes[0][1] === "lead",
       "class=lead: " + JSON.stringify(p.attributes));
console.log("ok: start tag with attrs");

// A Chars token for 'Hello '.
var chars = tokens.find(function (t) { return t.type === "Chars" && /Hello/.test(t.chars); });
assert(chars, "chars contains Hello");
console.log("ok: text content");

console.log("\nsimple-html-tokenizer smoke: all assertions passed");
