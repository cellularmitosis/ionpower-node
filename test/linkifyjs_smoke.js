// linkifyjs: detect URLs / emails / mentions in free text.

var linkify = require("./vendor/linkifyjs.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// linkify.find returns array of matches.
var matches = linkify.find("See https://example.com and email me at foo@bar.com");
assert(Array.isArray(matches), "linkify.find returns array");
assert(matches.length === 2, "found 2: got " + matches.length);

var urls  = matches.filter(function (m) { return m.type === "url"; });
var mails = matches.filter(function (m) { return m.type === "email"; });
assert(urls.length === 1 && urls[0].value === "https://example.com",
       "found URL: " + JSON.stringify(urls));
assert(mails.length === 1 && mails[0].value === "foo@bar.com",
       "found email: " + JSON.stringify(mails));
console.log("ok: linkifyjs.find (URL + email)");

// linkify.test / linkify.tokenize surface.
assert(linkify.test("https://example.com") === true, "test on link");
assert(linkify.test("plain text") === false, "test on plain");
console.log("ok: linkifyjs.test");

console.log("\nlinkifyjs smoke: all assertions passed");
