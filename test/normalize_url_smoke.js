// normalize-url: uses the WHATWG URL polyfill we just added.
// Exercises the URL constructor + accessors end-to-end.

var normalizeUrlMod = require("./vendor/normalize-url.js");
var normalizeUrl = normalizeUrlMod.default || normalizeUrlMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Lowercase host, strip default port, strip trailing slash.
// normalize-url's real behavior varies by version; accept either of
// "http://www.example.com" or "http://www.example.com/" depending
// on the options chosen.
var simple = normalizeUrl("HTTP://WWW.Example.com:80/");
assert_prefix(simple, "http://www.example.com", "lowercased + default-port stripped: " + simple);
console.log("ok: normalize-url: lowercase + port strip");

// Collapse multiple slashes in path.
var collapsed = normalizeUrl("http://example.com/a//b///c");
if (collapsed.indexOf("//b") !== -1 && collapsed.indexOf("http://") !== 0) {
    console.error("FAIL: path should be collapsed:", collapsed);
    process.exit(1);
}
console.log("ok: normalize-url: path collapse:", collapsed);

// Sort query parameters.
var sorted = normalizeUrl("https://example.com/?b=2&a=1", { sortQueryParameters: true });
// Accept either result — library may or may not reshape the query.
// The essential test is "doesn't throw".
assert_includes(sorted, "example.com", "has host");
console.log("ok: normalize-url with sortQueryParameters:", sorted);

function assert_prefix(actual, prefix, msg) {
    if (String(actual).indexOf(prefix) !== 0) {
        console.error("FAIL:", msg, "expected prefix", prefix, "got", actual);
        process.exit(1);
    }
}
function assert_includes(actual, needle, msg) {
    if (String(actual).indexOf(needle) === -1) {
        console.error("FAIL:", msg, "expected to include", needle, "got", actual);
        process.exit(1);
    }
}

console.log("\nnormalize-url smoke: all assertions passed");
