// Wave 1 Node-API smoke — os/querystring/url(full)/util/events/path.

var os = require("os");
var qs = require("querystring");
var url = require("url");
var util = require("util");
var events = require("events");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- os ---
eq(os.platform(), "darwin",  "os.platform");
eq(os.arch(),     "ppc",     "os.arch");
eq(os.type(),     "Darwin",  "os.type");
eq(os.endianness(), "BE",    "os.endianness: PPC");
assert(typeof os.release() === "string",  "os.release string");
assert(typeof os.version() === "string",  "os.version string");
assert(typeof os.uptime()  === "number",  "os.uptime number");
var la = os.loadavg();
assert(Array.isArray(la) && la.length === 3, "os.loadavg shape");
assert(typeof os.freemem()  === "number",  "os.freemem");
assert(typeof os.totalmem() === "number",  "os.totalmem");
var ui = os.userInfo();
assert(typeof ui.username === "string" && typeof ui.shell === "string",
       "os.userInfo shape");
var cpus = os.cpus();
assert(Array.isArray(cpus) && cpus.length >= 1 && cpus[0].model.length > 0,
       "os.cpus shape");
eq(os.constants.signals.SIGKILL, 9, "os.constants.signals.SIGKILL");
assert(typeof os.availableParallelism() === "number", "os.availableParallelism");
eq(os.EOL, "\n", "os.EOL");
console.log("ok: os");

// --- querystring ---
eq(qs.parse("a=1&b=2"),              { a: "1", b: "2" },       "qs.parse basic");
eq(qs.parse("k=%20%26"),             { k: " &" },              "qs.parse decode");
eq(qs.parse("a=1&a=2"),              { a: ["1", "2"] },        "qs.parse multi");
eq(qs.parse("a=1;b=2", ";"),         { a: "1", b: "2" },       "qs.parse sep");
eq(qs.stringify({ a: 1, b: 2 }),     "a=1&b=2",                "qs.stringify");
eq(qs.stringify({ a: [1, 2] }),      "a=1&a=2",                "qs.stringify array");
eq(qs.escape("a b&c"),               "a%20b%26c",              "qs.escape");
eq(qs.unescape("a%20b"),             "a b",                    "qs.unescape");
console.log("ok: querystring");

// --- url (full) ---
var u = url.parse("http://user:pw@example.com:8080/p/q?k=v#f");
eq(u.protocol,  "http:",       "url.parse protocol");
eq(u.host,      "example.com:8080", "url.parse host");
eq(u.hostname,  "example.com", "url.parse hostname");
eq(u.port,      "8080",        "url.parse port");
eq(u.auth,      "user:pw",     "url.parse auth");
eq(u.pathname,  "/p/q",        "url.parse pathname");
eq(u.search,    "?k=v",        "url.parse search");
eq(u.hash,      "#f",          "url.parse hash");
var uq = url.parse("/a?x=1&y=2", true);
eq(uq.query,    { x: "1", y: "2" }, "url.parse parseQS true");
eq(url.format({ protocol: "https:", slashes: true, hostname: "example.com", pathname: "/a", search: "?b=c" }),
   "https://example.com/a?b=c", "url.format");
eq(url.resolve("http://a.com/foo/bar", "baz"),   "http://a.com/foo/baz",  "url.resolve rel");
eq(url.resolve("http://a.com/foo/bar", "/qux"),  "http://a.com/qux",      "url.resolve abs");
eq(url.resolve("http://a.com/foo/bar", "../b"),  "http://a.com/b",        "url.resolve up");
eq(url.fileURLToPath("file:///tmp/x.js"), "/tmp/x.js", "url.fileURLToPath");
var pu = url.pathToFileURL("/tmp/y.js");
assert(String(pu.href).indexOf("file:///tmp/y.js") === 0, "url.pathToFileURL");
console.log("ok: url");

// --- util ---
assert(util.isDeepStrictEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }),
       "util.isDeepStrictEqual true");
assert(!util.isDeepStrictEqual({ a: 1 }, { a: 2 }),
       "util.isDeepStrictEqual false");
eq(util.stripVTControlCharacters("\x1b[31mred\x1b[0m"), "red", "util.stripVTControlCharacters");
var pa = util.parseArgs({
    args: ["--name", "bob", "--verbose", "pos1"],
    options: { name: { type: "string" }, verbose: { type: "boolean" } },
    allowPositionals: true
});
eq(pa.values.name,     "bob", "parseArgs string");
eq(pa.values.verbose,  true,  "parseArgs bool");
eq(pa.positionals,     ["pos1"], "parseArgs positionals");
console.log("ok: util");

// --- events ---
var ee = new events.EventEmitter();
var pre = [];
ee.on("x", function () { pre.push("mid"); });
ee.prependListener("x", function () { pre.push("first"); });
ee.emit("x");
eq(pre, ["first", "mid"], "prependListener order");

var names = ee.eventNames();
assert(names.indexOf("x") >= 0, "eventNames has 'x'");

// off alias
var fn = function () {};
ee.on("y", fn);
ee.off("y", fn);
eq(ee.listenerCount("y"), 0, "off alias removes");

// events.once returns Promise
var emitter = new events.EventEmitter();
var resolved = null;
events.once(emitter, "boom").then(function (args) { resolved = args; });
emitter.emit("boom", 1, 2);
eq(resolved, [1, 2], "events.once promise settles");
console.log("ok: events");

// --- path ---
eq(path.normalize("/a/./b/../c/"), "/a/c/", "path.normalize");
eq(path.normalize("a/b/../c"),     "a/c",   "path.normalize rel");
eq(path.relative("/a/b/c", "/a/b/d/e"),  "../d/e", "path.relative");
eq(path.relative("/same", "/same"),      "",       "path.relative same");
var pp = path.parse("/a/b/c.txt");
eq(pp.dir,  "/a/b",    "path.parse.dir");
eq(pp.base, "c.txt",   "path.parse.base");
eq(pp.ext,  ".txt",    "path.parse.ext");
eq(pp.name, "c",       "path.parse.name");
eq(path.format({ dir: "/a/b", base: "c.txt" }), "/a/b/c.txt", "path.format");
assert(path.posix === path, "path.posix is self");
assert(typeof path.win32.join === "function", "path.win32.join");
eq(path.delimiter, ":", "path.delimiter");
console.log("ok: path");

console.log("\nwave1_api smoke: all assertions passed");
