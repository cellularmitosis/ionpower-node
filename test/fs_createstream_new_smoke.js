// Regression test: fs.createReadStream / createWriteStream must work
// when called with `new`. graceful-fs wraps fs.ReadStream like this:
//
//   function ReadStream (path, options) {
//     if (this instanceof ReadStream)
//       return fs$ReadStream.apply(this, arguments), this  // <- discards return
//     ...
//   }
//
// The comma operator throws away the return value of our function and
// returns the empty `this` instead. If our createReadStream doesn't
// populate `this`, graceful-fs hands cacache/pump an empty object,
// which errors with "stream.on is not a function" the moment pump's
// destroyer calls `stream.on('close', ...)`.

var fs = require("fs");
var os = require("os");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Pre-create a small file we can read.
var tmpFile = path.join(os.tmpdir(), "ionpower-fs-newstream-" + process.pid + ".txt");
fs.writeFileSync(tmpFile, "hello new stream\n");

// --- new fs.createReadStream(path) — graceful-fs's pattern ---
var rs = new fs.createReadStream(tmpFile);
assert(typeof rs.on === "function",        "new createReadStream → has .on");
assert(typeof rs.pipe === "function",      "new createReadStream → has .pipe");
assert(typeof rs.destroy === "function",   "new createReadStream → has .destroy");
assert(rs.path === tmpFile,                "new createReadStream → .path set");

// --- new fs.ReadStream(path) — same alias ---
var rs2 = new fs.ReadStream(tmpFile);
assert(typeof rs2.on === "function",       "new fs.ReadStream → has .on");
assert(typeof rs2.pipe === "function",     "new fs.ReadStream → has .pipe");

// --- Plain-call fs.createReadStream(path) still works ---
var rs3 = fs.createReadStream(tmpFile);
assert(typeof rs3.on === "function",       "plain createReadStream → has .on");

// --- new createWriteStream populates this too ---
var tmpOut = tmpFile + ".out";
var ws = new fs.createWriteStream(tmpOut);
assert(typeof ws.on === "function",        "new createWriteStream → has .on");
assert(typeof ws.write === "function",     "new createWriteStream → has .write");
assert(typeof ws.end === "function",       "new createWriteStream → has .end");
assert(ws.path === tmpOut,                 "new createWriteStream → .path set");

// --- Functional read with `new` form ---
var collected = "";
rs.on("data", function (c) { collected += String(c); });
rs.on("end", function () {
    if (collected !== "hello new stream\n") {
        console.error("FAIL: expected 'hello new stream\\n', got " + JSON.stringify(collected));
        process.exit(1);
    }
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    try { fs.unlinkSync(tmpOut); } catch (e) {}
    console.log("ok: new fs.createReadStream functional read");
    console.log("\nfs_createstream_new smoke: all assertions passed");
});
