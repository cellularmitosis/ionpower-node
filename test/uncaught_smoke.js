// process.on('uncaughtException') + 'unhandledRejection' smoke.
// Drive in a child process so the smoke doesn't kill itself.

var fs = require("fs");
var child_process = require("child_process");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- uncaughtException ----
var src1 = [
    "process.on('uncaughtException', function (err, origin) {",
    "  console.log('CAUGHT_UE:', err.message, '@', origin);",
    "});",
    "setTimeout(function () { throw new Error('boom-timer'); }, 10);"
].join("\n");

var tmp1 = "/tmp/ion_uncaught_" + process.pid + ".js";
fs.writeFileSync(tmp1, src1);
var r1 = child_process.spawnSync(process.argv[0], [tmp1], { encoding: "utf8" });
fs.unlinkSync(tmp1);
assert(r1.stdout.indexOf("CAUGHT_UE: boom-timer @ timer") >= 0,
       "uncaughtException fires with origin (got: " + r1.stdout + ")");
console.log("ok: uncaughtException");

// ---- unhandledRejection ----
var src2 = [
    "process.on('unhandledRejection', function (reason, p) {",
    "  console.log('CAUGHT_UR:', reason.message);",
    "});",
    "Promise.reject(new Error('rejected-no-catch'));"
].join("\n");

var tmp2 = "/tmp/ion_unhandled_" + process.pid + ".js";
fs.writeFileSync(tmp2, src2);
var r2 = child_process.spawnSync(process.argv[0], [tmp2], { encoding: "utf8" });
fs.unlinkSync(tmp2);
assert(r2.stdout.indexOf("CAUGHT_UR: rejected-no-catch") >= 0,
       "unhandledRejection fires (got: " + r2.stdout + ")");
console.log("ok: unhandledRejection");

// ---- rejectionHandled when .catch attaches late ----
var src3 = [
    "var p = Promise.reject(new Error('late'));",
    "var unhandled = false;",
    "process.on('unhandledRejection', function () { unhandled = true; });",
    "process.on('rejectionHandled', function () { console.log('REHANDLED'); });",
    "// Attach late, in next microtask",
    "setImmediate(function () {",
    "  setImmediate(function () {",
    "    p.catch(function () {});",
    "    setImmediate(function () { console.log('end unhandled=' + unhandled); });",
    "  });",
    "});"
].join("\n");

var tmp3 = "/tmp/ion_rehandled_" + process.pid + ".js";
fs.writeFileSync(tmp3, src3);
var r3 = child_process.spawnSync(process.argv[0], [tmp3], { encoding: "utf8" });
fs.unlinkSync(tmp3);
// We expect unhandledRejection to fire first (microtask after the rejection)
// then rejectionHandled when .catch attaches later.
assert(r3.stdout.indexOf("REHANDLED") >= 0,
       "rejectionHandled fires when .catch attaches late (got: " + r3.stdout + ")");
console.log("ok: rejectionHandled (late .catch)");

// ---- handler that returns truthy doesn't print error ----
var src4 = [
    "process.on('uncaughtException', function () { /* swallow */ });",
    "setTimeout(function () { throw new Error('silent'); }, 10);",
    "setTimeout(function () { console.log('after-throw'); }, 50);"
].join("\n");

var tmp4 = "/tmp/ion_uefh_" + process.pid + ".js";
fs.writeFileSync(tmp4, src4);
var r4 = child_process.spawnSync(process.argv[0], [tmp4], { encoding: "utf8" });
fs.unlinkSync(tmp4);
assert(r4.stdout.indexOf("after-throw") >= 0, "process keeps going after handled exception");
assert(r4.stderr.indexOf("silent") < 0 || r4.stderr.length === 0, "no stderr fallback (handler caught)");
console.log("ok: handler suppresses default stderr");

console.log("\nuncaught smoke: all assertions passed");
