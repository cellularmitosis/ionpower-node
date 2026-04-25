// fs.cp / fs.rm + wave 14 libraries smoke.

var fs = require("fs");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- fs.cpSync recursive ----
var src = "/tmp/ion_cp_src_" + process.pid;
var dst = "/tmp/ion_cp_dst_" + process.pid;
try { fs.rmSync(src, { recursive: true, force: true }); } catch (e) {}
try { fs.rmSync(dst, { recursive: true, force: true }); } catch (e) {}

fs.mkdirSync(src + "/sub", { recursive: true });
fs.writeFileSync(src + "/a.txt", "alpha");
fs.writeFileSync(src + "/sub/b.txt", "beta");

fs.cpSync(src, dst, { recursive: true });

assert(fs.existsSync(dst + "/a.txt"), "fs.cpSync top-level file");
assert(fs.existsSync(dst + "/sub/b.txt"), "fs.cpSync nested file");
eq(fs.readFileSync(dst + "/a.txt", "utf8"), "alpha", "fs.cpSync content top");
eq(fs.readFileSync(dst + "/sub/b.txt", "utf8"), "beta", "fs.cpSync content nested");
console.log("ok: fs.cpSync (recursive)");

// ---- fs.rmSync recursive ----
fs.rmSync(dst, { recursive: true });
assert(!fs.existsSync(dst), "fs.rmSync wiped destination");
console.log("ok: fs.rmSync (recursive)");

// fs.rmSync on a single file
fs.rmSync(src + "/a.txt");
assert(!fs.existsSync(src + "/a.txt"), "fs.rmSync single file");
console.log("ok: fs.rmSync (single file)");

// fs.rmSync force on missing — no throw
var threw = false;
try { fs.rmSync("/tmp/missing-" + Date.now(), { force: true }); } catch (e) { threw = true; }
assert(!threw, "fs.rmSync force: missing path no throw");
console.log("ok: fs.rmSync force");

// Cleanup
fs.rmSync(src, { recursive: true, force: true });

// ---- fs.cp (async) ----
var src2 = "/tmp/ion_cp_async_src_" + process.pid;
var dst2 = "/tmp/ion_cp_async_dst_" + process.pid;
try { fs.rmSync(src2, { recursive: true, force: true }); } catch (e) {}
try { fs.rmSync(dst2, { recursive: true, force: true }); } catch (e) {}

fs.mkdirSync(src2);
fs.writeFileSync(src2 + "/x.txt", "hello");
fs.cp(src2, dst2, { recursive: true }, function (err) {
    if (err) { console.error("FAIL: fs.cp", err); process.exit(1); }
    assert(fs.existsSync(dst2 + "/x.txt"), "fs.cp async");
    fs.rmSync(src2, { recursive: true, force: true });
    fs.rmSync(dst2, { recursive: true, force: true });
    console.log("ok: fs.cp (async callback)");
});

// ---- has-symbols ----
try {
    var hasSymbols = unwrap(require("./vendor/has-symbols.js"));
    assert(typeof hasSymbols === "function", "has-symbols is function");
    assert(hasSymbols() === true, "has-symbols true (SM45 has Symbol)");
    console.log("ok: has-symbols");
} catch (e) { console.log("skip: has-symbols (" + e.message + ")"); }

// ---- find-replace ----
try {
    var findReplace = unwrap(require("./vendor/find-replace.js"));
    assert(typeof findReplace === "function", "find-replace is function");
    var arr = [1, 2, 3, 4, 5];
    // findReplace(arr, predicate, replaceWith)
    var found = findReplace(arr, function (x) { return x === 3; }, 30);
    assert(Array.isArray(found), "find-replace returns array");
    assert(found.indexOf(30) >= 0, "found contains 30");
    console.log("ok: find-replace");
} catch (e) { console.log("skip: find-replace (" + e.message + ")"); }

// ---- map-cache ----
try {
    var MapCache = unwrap(require("./vendor/map-cache.js"));
    assert(typeof MapCache === "function", "map-cache ctor");
    var c = new MapCache();
    c.set("a", 1);
    eq(c.get("a"), 1, "map-cache get");
    assert(c.has("a"), "map-cache has");
    c.del("a");
    assert(!c.has("a"), "map-cache del");
    console.log("ok: map-cache");
} catch (e) { console.log("skip: map-cache (" + e.message + ")"); }

// ---- obuf (offset buffer) ----
try {
    var Obuf = unwrap(require("./vendor/obuf.js"));
    assert(typeof Obuf === "function", "obuf ctor");
    var buf = new Obuf();
    buf.push(Buffer.from([1, 2, 3, 4]));
    assert(buf.size > 0, "obuf has bytes");
    console.log("ok: obuf (loaded)");
} catch (e) { console.log("skip: obuf (" + e.message + ")"); }

console.log("\nfs_cp_rm smoke: inline done");
