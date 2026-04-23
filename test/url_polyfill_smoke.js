// WHATWG URL polyfill: a tiny (~150-line) implementation that
// covers the protocol/host/hostname/port/pathname/search/hash/origin/
// href surface plus URLSearchParams. Not spec-complete, but enough
// for libraries that parse and read URL components.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Full URL.
var u = new URL("https://user:pass@example.com:8080/path/to?q=1&r=two#frag");
assert(u.protocol === "https:",        "protocol");
assert(u.username === "user",          "username");
assert(u.password === "pass",          "password");
assert(u.host === "example.com:8080",  "host");
assert(u.hostname === "example.com",   "hostname");
assert(u.port === "8080",              "port");
assert(u.pathname === "/path/to",      "pathname");
assert(u.search === "?q=1&r=two",      "search");
assert(u.hash === "#frag",             "hash");
assert(u.origin === "https://example.com:8080", "origin");
console.log("ok: URL full parse (10 components)");

// href reassembles.
var href = u.href;
assert(href.indexOf("https://") === 0, "href starts with protocol");
assert(href.indexOf("#frag") !== -1, "href has hash");
console.log("ok: URL.href reassembles");

// toString / toJSON
assert(u.toString() === u.href, "toString == href");
assert(u.toJSON()   === u.href, "toJSON == href");
console.log("ok: URL.toString + toJSON");

// Relative path resolution.
var r = new URL("/new", "https://example.com/old/path");
assert(r.host === "example.com", "base host kept");
assert(r.pathname === "/new",    "new abs path");
console.log("ok: URL relative (absolute path)");

// URLSearchParams standalone.
var sp = new URLSearchParams("a=1&b=2&a=3");
assert(sp.get("a") === "1",         "first a=1");
assert(sp.getAll("a").length === 2, "two a values");
assert(sp.has("b"),                 "has b");
assert(!sp.has("c"),                "no c");
console.log("ok: URLSearchParams get/getAll/has");

// mutate
sp.set("a", "99");
assert(sp.get("a") === "99",        "set collapses duplicates");
assert(sp.getAll("a").length === 1, "one a after set");
sp.append("x", "yes");
assert(sp.has("x"),                 "append adds");
sp["delete"]("b");
assert(!sp.has("b"),                "delete removes");
console.log("ok: URLSearchParams set/append/delete");

// toString
var encoded = new URLSearchParams({ q: "hello world", tag: "a&b" }).toString();
assert(encoded.indexOf("hello%20world") !== -1 || encoded.indexOf("hello+world") !== -1,
       "space encoded: " + encoded);
assert(encoded.indexOf("a%26b") !== -1, "& encoded: " + encoded);
console.log("ok: URLSearchParams.toString encodes");

// from URL: u.searchParams should reflect parsed query.
assert(u.searchParams.get("q")   === "1",   "searchParams.get q");
assert(u.searchParams.get("r")   === "two", "searchParams.get r");
console.log("ok: URL.searchParams reflects parsed query");

console.log("\nURL polyfill smoke: all assertions passed");
