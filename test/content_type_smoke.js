// content-type: parse/format HTTP Content-Type header.

var ct = require("./vendor/content-type.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

var p = ct.parse("application/json; charset=UTF-8");
eq(p.type, "application/json", "type");
eq(p.parameters.charset, "UTF-8", "charset preserved as-written");
console.log("ok: parse");

var s = ct.format({ type: "text/html", parameters: { charset: "utf-8" } });
assert(s.indexOf("text/html") === 0, "format starts with type");
assert(s.indexOf("charset=utf-8") >= 0, "format includes charset");
console.log("ok: format:", s);

console.log("\ncontent-type smoke: all assertions passed");
