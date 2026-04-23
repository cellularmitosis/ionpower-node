// http.getSync / postSync smoke — shells out to curl for a blocking
// HTTP request. Requires network + /opt/tigersh-deps-0.1/bin/curl.
// Gracefully skips when network is unavailable (make test-all stays green
// on offline hosts).

var http = require("http");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Plain HTTP against example.com. If the first request fails outright,
// the host likely has no network — skip rather than FAIL.
console.log("GET http://example.com ...");
var r;
try {
    r = http.getSync("http://example.com", { timeout: 10 });
} catch (e) {
    console.log("skip: network unreachable (" + e.message + ")");
    console.log("\nhttp smoke: skipped (offline)");
    process.exit(0);
}
assert(typeof r === "object", "response is object");
assert(r.status === 200, "status 200; got " + r.status);
assert(typeof r.body === "string", "body is string");
assert(r.body.indexOf("Example Domain") >= 0, "body has Example Domain");
console.log("ok: http://example.com status=200, " + r.body.length + " bytes");

// HTTPS with CA bundle.
console.log("\nGET https://example.com ...");
var s = http.getSync("https://example.com");
assert(s.status === 200, "https status 200; got " + s.status);
assert(s.body.indexOf("Example Domain") >= 0, "https body has Example Domain");
console.log("ok: https://example.com status=200, " + s.body.length + " bytes");

// Headers parsing.
console.log("\nInspect response headers for https://example.com ...");
assert(typeof s.headers === "object", "headers object present");
var ct = s.headers["content-type"];
assert(ct && ct.indexOf("text/html") >= 0, "content-type: " + ct);
console.log("ok: headers.content-type =", ct);

// 404 path.
console.log("\nGET https://example.com/nonexistent-404 ...");
var n = http.getSync("https://example.com/nonexistent-404");
assert(n.status === 404, "404 expected; got " + n.status);
console.log("ok: 404 status returned");

// Custom headers.
console.log("\nGET with custom user-agent header ...");
var u = http.getSync("http://example.com", {
    headers: { "X-Ionpower": "yes" }
});
assert(u.status === 200, "ua test status 200");
console.log("ok: custom headers accepted (request sent, response 200)");

// Bytes access for binary payloads.
assert(u.bodyBytes instanceof Uint8Array, "bodyBytes is Uint8Array");
assert(u.bodyBytes.length === u.body.length ||
       Math.abs(u.bodyBytes.length - u.body.length) < 100,
       "byte length close to char length (ASCII body)");
console.log("ok: bodyBytes Uint8Array exposed");

console.log("\nhttp smoke: all assertions passed");
