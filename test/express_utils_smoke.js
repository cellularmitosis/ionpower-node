// Express ecosystem core utilities: etag, fresh, basic-auth, destroy,
// encodeurl, parseurl, on-finished, ee-first, uri-js, fast-diff,
// deep-freeze-strict, merge-descriptors.

var etag     = require("./vendor/etag.js");
var fresh    = require("./vendor/fresh.js");
var basicAuth= require("./vendor/basic-auth.js");
var encodeurl = require("./vendor/encodeurl.js");
var parseurl = require("./vendor/parseurl.js");
var onFinished = require("./vendor/on-finished.js");
var eeFirst = require("./vendor/ee-first.js");
var uriJs = require("./vendor/uri-js.js");
var fastDiff = require("./vendor/fast-diff.js");
var deepFreezeStrict = require("./vendor/deep-freeze-strict.js");
var mergeDesc = require("./vendor/merge-descriptors.js");

encodeurl = encodeurl.default || encodeurl;
basicAuth = basicAuth.default || basicAuth;
parseurl = parseurl.default || parseurl;
fastDiff = fastDiff.default || fastDiff;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// etag: compute for a string entity.
var e = etag("hello");
assert(typeof e === "string" && e.length > 0, "etag string: " + e);
console.log("ok: etag");

// fresh: check Last-Modified / ETag cache.
assert(typeof fresh === "function", "fresh is function");
console.log("ok: fresh");

// basic-auth: parse Authorization header.
var fakeReq = { headers: { authorization: "Basic " + Buffer.from("user:pass").toString("base64") } };
var creds = basicAuth(fakeReq);
assert(creds && creds.name === "user" && creds.pass === "pass",
       "basic-auth parsed: " + JSON.stringify(creds));
console.log("ok: basic-auth");

// encodeurl: encode URL while preserving ?, =, /.
var enc = encodeurl("https://example.com/path with spaces?q=hello world");
assert(enc.indexOf("%20") !== -1, "spaces encoded: " + enc);
assert(enc.indexOf("?q=") !== -1, "? preserved");
console.log("ok: encodeurl");

// parseurl: parse req.url-style URL.
var reqUrl = { url: "/api/users?page=2" };
var parsed = parseurl(reqUrl);
assert(parsed.pathname === "/api/users", "pathname");
assert(parsed.query === "page=2",        "query");
console.log("ok: parseurl");

// on-finished: just check it loads + its API shape.
assert(typeof onFinished === "function", "on-finished is function");
assert(typeof onFinished.isFinished === "function", ".isFinished is function");
console.log("ok: on-finished");

// ee-first: race multiple EE events.
var events = require("events");
var ee = new events.EventEmitter();
var eeFired = false;
eeFirst([[ee, "a", "b"]], function (err, ee2, event) {
    eeFired = true;
});
ee.emit("a");
assert(eeFired, "ee-first fired on 'a'");
console.log("ok: ee-first");

// uri-js: parse URI per RFC 3986.
var parsedUri = uriJs.parse("https://example.com/path?q=1#frag");
assert(parsedUri.scheme === "https", "scheme");
assert(parsedUri.host === "example.com", "host");
console.log("ok: uri-js");

// fast-diff: Myers diff.
var diff = fastDiff("hello world", "hello node");
assert(Array.isArray(diff), "fastDiff returns array");
assert(diff.length > 0, "non-empty diff");
console.log("ok: fast-diff");

// deep-freeze-strict.
var o = { a: { b: 1 } };
deepFreezeStrict(o);
assert(Object.isFrozen(o), "top frozen");
assert(Object.isFrozen(o.a), "nested frozen");
console.log("ok: deep-freeze-strict");

// merge-descriptors: copy own property descriptors.
var target = { x: 1 };
mergeDesc(target, { y: 2 });
assert(target.y === 2, "merged y");
console.log("ok: merge-descriptors");

console.log("\nexpress_utils smoke: all assertions passed");
