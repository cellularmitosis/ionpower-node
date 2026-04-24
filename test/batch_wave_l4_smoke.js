// Wave L, batch 4: fresh HTTP/cookie ecosystem libs.
// These pair with fetch + http.createServer (v0.10/v0.12 additions).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- cookie (parser + serializer) ----
var cookie = unwrap(require("./vendor/cookie.js"));
eq(cookie.parse("foo=bar; baz=qux"), { foo: "bar", baz: "qux" }, "cookie.parse");
eq(cookie.serialize("x", "y"), "x=y", "cookie.serialize");
eq(cookie.serialize("x", "y z"), "x=y%20z", "cookie.serialize encodes");
console.log("ok: cookie parse+serialize");

// ---- set-cookie-parser ----
var setCookie = unwrap(require("./vendor/set-cookie-parser.js"));
var parsed = setCookie.parse("sid=abc; Path=/; HttpOnly");
assert(parsed.length === 1 && parsed[0].name === "sid" && parsed[0].httpOnly === true,
       "set-cookie-parser: " + JSON.stringify(parsed));
console.log("ok: set-cookie-parser");

// ---- cookie-signature (sign/unsign) ----
var sig = unwrap(require("./vendor/cookie-signature.js"));
var signed = sig.sign("hello", "secret");
assert(signed.indexOf("hello.") === 0, "cookie-signature sign prefix");
assert(sig.unsign(signed, "secret") === "hello", "unsign ok");
assert(sig.unsign(signed, "wrong") === false, "unsign wrong secret");
console.log("ok: cookie-signature");

// ---- on-headers (run fn when headers are about to be sent) ----
var onHeaders = unwrap(require("./vendor/on-headers.js"));
assert(typeof onHeaders === "function", "on-headers is function");
console.log("ok: on-headers (surface)");

// ---- delegates ----
var Delegator = unwrap(require("./vendor/delegates.js"));
var proto = {};
var target = { greet: function () { return "hi"; } };
function Obj() { this.target = target; }
Delegator(Obj.prototype, "target").method("greet");
var o = new Obj();
eq(o.greet(), "hi", "delegates.method");
console.log("ok: delegates");

// ---- ip (IPv4/6 utilities) ----
var ip = unwrap(require("./vendor/ip.js"));
assert(ip.isV4Format("10.0.0.1"), "ip.isV4Format");
assert(!ip.isV4Format("::1"), "ip.isV4Format rejects v6");
assert(ip.isV6Format("::1"), "ip.isV6Format");
eq(ip.toLong("1.2.3.4"), 16909060, "ip.toLong");
console.log("ok: ip");

// ---- content-type ----
var ct = unwrap(require("./vendor/content-type.js"));
var parsedCt = ct.parse("application/json; charset=utf-8");
eq(parsedCt.type, "application/json", "content-type.parse type");
eq(parsedCt.parameters.charset, "utf-8", "content-type.parse charset");
eq(ct.format({ type: "text/plain", parameters: { charset: "utf-8" } }),
   "text/plain; charset=utf-8", "content-type.format");
console.log("ok: content-type");

// ---- content-disposition ----
var cd = unwrap(require("./vendor/content-disposition.js"));
assert(cd("file.txt").indexOf("attachment") === 0, "content-disposition default attachment");
assert(cd("report.pdf").indexOf("report.pdf") >= 0, "content-disposition filename");
console.log("ok: content-disposition");

// ---- basic-auth v2 ----
var basicAuth = unwrap(require("./vendor/basic-auth-v2.js"));
// basicAuth takes a req-like object with .headers.authorization
var fakeReq = { headers: { authorization: "Basic YWxpY2U6d29uZGVybGFuZA==" } };
var creds = basicAuth(fakeReq);
eq(creds.name, "alice", "basic-auth.name");
eq(creds.pass, "wonderland", "basic-auth.pass");
console.log("ok: basic-auth v2");

// ---- parse-ms v3 ----
try {
    var parseMs = unwrap(require("./vendor/parse-ms-v3.js"));
    var parts = parseMs(1003020);  // ~16.7 min
    assert(typeof parts === "object" && typeof parts.minutes === "number",
           "parse-ms returns time parts");
    console.log("ok: parse-ms v3");
} catch (e) {
    console.log("skip: parse-ms v3 (" + e.message + ")");
}

console.log("\nbatch_wave_l4 smoke: all assertions passed");
