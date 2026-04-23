// HTTP utility batch: type-is, media-typer, forwarded, vary,
// cookie-parser. Pieces of the Express / Koa middleware family
// we can validate in isolation.

var typeIs = require("./vendor/type-is.js");
var mediaTyper = require("./vendor/media-typer.js");
var forwarded = require("./vendor/forwarded.js");
var vary = require("./vendor/vary.js");
var cookieParser = require("./vendor/cookie-parser.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// type-is.is(value, types): test raw content-type string directly.
var jsonResult = typeIs.is("application/json", ["json"]);
assert(jsonResult === "json" || jsonResult === "application/json",
       "json content-type; got: " + jsonResult);
assert(typeIs.is("application/json", ["html"]) === false, "not html");
console.log("ok: type-is");

// media-typer.parse: parse a bare MIME type (this version is
// strict about parameter form).
var parsed = mediaTyper.parse("application/json");
assert(parsed.type === "application", "type=application");
assert(parsed.subtype === "json",     "subtype=json");
console.log("ok: media-typer.parse");

// forwarded(req): returns chain of IPs.
var req2 = {
    headers: { "x-forwarded-for": "203.0.113.1, 192.168.1.1" },
    connection: { remoteAddress: "10.0.0.1" },
    socket: { remoteAddress: "10.0.0.1" }
};
var addrs = forwarded(req2);
assert(Array.isArray(addrs), "forwarded returns array");
assert(addrs.length >= 2, "at least 2 entries");
console.log("ok: forwarded (" + addrs.length + " addrs)");

// vary: add a header.
var headers = {};
var fakeRes = {
    getHeader: function (n) { return headers[n.toLowerCase()]; },
    setHeader: function (n, v) { headers[n.toLowerCase()] = v; }
};
vary(fakeRes, "Accept-Encoding");
vary(fakeRes, "Accept-Language");
assert(headers["vary"] === "Accept-Encoding, Accept-Language",
       "vary value: " + headers["vary"]);
console.log("ok: vary");

// cookie-parser: middleware factory.
assert(typeof cookieParser === "function", "cookieParser is function");
var mw = cookieParser("secret");
assert(typeof mw === "function" && mw.length === 3, "middleware is 3-arg fn");
console.log("ok: cookie-parser (factory + middleware shape)");

console.log("\nhttp_utils smoke: all assertions passed");
