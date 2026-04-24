// Wave 3/4: child_process.execSync + spawnSync + zlib stub + process.stdin.

var cp = require("child_process");
var zlib = require("zlib");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- execSync ---
var out = cp.execSync("echo hello-world");
// Result is Buffer; toString('utf8').
eq(out.toString("utf8").trim(), "hello-world", "execSync echo");

// With encoding option: returns string directly.
var out2 = cp.execSync("printf abc", { encoding: "utf8" });
eq(out2, "abc", "execSync encoding utf8");

// With input option: pass via stdin.
var out3 = cp.execSync("tr a-z A-Z", { input: "hello" });
eq(out3.toString("utf8").trim(), "HELLO", "execSync input");

// Non-zero exit throws, and exception carries stderr.
var threw = null;
try { cp.execSync("false"); } catch (e) { threw = e; }
assert(threw, "execSync non-zero throws");
assert(threw.status !== 0, "execSync error.status set");
console.log("ok: execSync");

// --- spawnSync ---
var r = cp.spawnSync("echo", ["one", "two"], { encoding: "utf8" });
eq(r.status, 0, "spawnSync status ok");
eq(r.stdout.trim(), "one two", "spawnSync stdout");
eq(r.stderr, "", "spawnSync stderr empty");

var r2 = cp.spawnSync("sh", ["-c", "echo out; echo err 1>&2; exit 3"],
                      { encoding: "utf8" });
eq(r2.status, 3, "spawnSync exit 3");
assert(r2.stderr.indexOf("err") >= 0, "spawnSync stderr captured");
console.log("ok: spawnSync");

// --- execFileSync ---
var r3 = cp.execFileSync("/bin/echo", ["abc"], { encoding: "utf8" });
eq(r3.trim(), "abc", "execFileSync");
console.log("ok: execFileSync");

// --- zlib works (deflate real as of v0.14) ---
assert(typeof zlib.createGzip === "function", "zlib.createGzip present");
assert(typeof zlib.gzipSync === "function", "zlib.gzipSync present");
var gzOut = zlib.gzipSync("hi");
assert(gzOut[0] === 0x1f && gzOut[1] === 0x8b, "gzipSync outputs gzip magic");
assert(zlib.gunzipSync(gzOut).toString("utf8") === "hi", "gzip round-trip");
eq(zlib.constants.Z_NO_FLUSH, 0, "zlib.constants.Z_NO_FLUSH");
console.log("ok: zlib (compression + constants)");

// --- process.stdin basics ---
assert(typeof process.stdin.on === "function", "process.stdin.on");
assert(typeof process.stdin.pause === "function", "process.stdin.pause");
assert(typeof process.stdin.resume === "function", "process.stdin.resume");
assert(typeof process.stdin.isTTY === "boolean", "process.stdin.isTTY");
console.log("ok: process.stdin shape");

console.log("\nwave3_child_process smoke: all assertions passed");
