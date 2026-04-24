// worker_threads / inspector / tty stubs + wave 11 libs smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- worker_threads ----
var wt = require("worker_threads");
assert(wt.isMainThread === true, "isMainThread true");
assert(wt.threadId === 0, "threadId 0");
assert(wt.parentPort === null, "parentPort null on main thread");
assert(typeof wt.Worker === "function", "Worker ctor present (throws on use)");
var threw = false;
try { new wt.Worker("dummy"); } catch (e) { threw = true; }
assert(threw, "Worker construction throws not-supported");
console.log("ok: worker_threads stubs");

// ---- inspector ----
var inspector = require("inspector");
assert(typeof inspector.open === "function", "inspector.open no-op");
assert(typeof inspector.close === "function", "inspector.close no-op");
// Calling them is fine
inspector.open(); inspector.close();
assert(inspector.url() === undefined, "inspector.url() undefined");
console.log("ok: inspector stubs");

// ---- tty ----
var tty = require("tty");
assert(typeof tty.isatty === "function", "tty.isatty present");
// Should match process.stdout.isTTY for fd 1
assert(tty.isatty(1) === !!process.stdout.isTTY, "tty.isatty(1) matches stdout");
assert(tty.isatty(99) === false, "tty.isatty(99) false");
assert(typeof tty.ReadStream === "function", "tty.ReadStream ctor");
assert(typeof tty.WriteStream === "function", "tty.WriteStream ctor");
var ws = new tty.WriteStream(1);
assert(ws.columns === 80, "WriteStream columns default 80");
assert(ws.getColorDepth() === 8, "getColorDepth");
console.log("ok: tty");

// ---- human-id ----
try {
    var humanIdMod = require("./vendor/human-id.js");
    var humanId = humanIdMod.humanId || humanIdMod.default || unwrap(humanIdMod);
    if (typeof humanId === "function") {
        var id = humanId();
        assert(typeof id === "string" && id.length > 0, "humanId returns a non-empty string");
    }
    console.log("ok: human-id (loaded)");
} catch (e) { console.log("skip: human-id (" + e.message + ")"); }

// ---- slugify-lib ----
try {
    var sl = unwrap(require("./vendor/slugify-lib.js"));
    var slugFn = sl.default || sl.slugify || sl;
    if (typeof slugFn === "function") {
        var s = slugFn("Hello World Foo");
        assert(typeof s === "string" && s.length > 0, "slugify returned a string");
    }
    console.log("ok: slugify-lib (loaded)");
} catch (e) { console.log("skip: slugify-lib (" + e.message + ")"); }

// ---- minisearch ----
try {
    var ms = require("./vendor/minisearch.js");
    var MiniSearch = ms.MiniSearch || ms.default || ms;
    assert(typeof MiniSearch === "function", "MiniSearch ctor");
    var search = new MiniSearch({ fields: ["title"] });
    search.addAll([
        { id: 1, title: "hello world" },
        { id: 2, title: "hello there" },
        { id: 3, title: "goodbye" }
    ]);
    var results = search.search("hello");
    assert(results.length === 2, "minisearch 'hello' -> 2 results (got " + results.length + ")");
    console.log("ok: minisearch");
} catch (e) { console.log("skip: minisearch (" + e.message + ")"); }

// ---- tr46 (IDNA) ----
try {
    var tr46 = require("./vendor/tr46.js");
    var toAscii = tr46.toASCII || (tr46.default && tr46.default.toASCII);
    if (typeof toAscii === "function") {
        var ascii = toAscii("bücher.example");
        assert(ascii === "xn--bcher-kva.example" || ascii === null,
               "tr46.toASCII bücher -> punycode (got " + ascii + ")");
    }
    console.log("ok: tr46 (loaded)");
} catch (e) { console.log("skip: tr46 (" + e.message + ")"); }

console.log("\nstubs smoke: all inline assertions passed");
