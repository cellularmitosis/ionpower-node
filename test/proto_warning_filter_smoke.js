// Verifies that the SM45 "mutating the [[Prototype]]" warning is
// silenced by default and re-enabled by IONPOWER_TRACE_PROTO_WARN=1.

var cp = require("child_process");
var fs = require("fs");
var path = require("path");

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

// Trigger script: assign to __proto__ on an existing object — SM45's
// canonical trigger for the prototype-mutation perf warning. Also write
// a sentinel to stderr so we can confirm the child ran to completion.
var TRIGGER = [
    "var o = {};",
    "o.__proto__ = { x: 1 };",
    "process.stderr.write('SENTINEL_END\\n');"
].join("\n");

var tmp = path.join("/tmp", "proto-warn-" + process.pid + ".js");
fs.writeFileSync(tmp, TRIGGER);

var execPath = process.execPath;
if (!execPath) fail("process.execPath is empty");

function runChild(env, done) {
    var sp = cp.spawn(execPath, [tmp], { env: env });
    var out = "", err = "";
    sp.stdout.on("data", function (d) { out += String(d); });
    sp.stderr.on("data", function (d) { err += String(d); });
    sp.on("exit", function (code) { done(code, out, err); });
}

var ranQuiet = false, ranLoud = false;

// 1) Default mode: warning should be absent.
runChild({ IONPOWER_TRACE_PROTO_WARN: "0", PATH: process.env.PATH || "" },
    function (code, out, err) {
        ranQuiet = true;
        if (code !== 0) fail("default-mode child exit " + code + " stderr=" + JSON.stringify(err));
        if (err.indexOf("SENTINEL_END") < 0) fail("default-mode child did not run to completion; stderr=" + JSON.stringify(err));
        if (err.indexOf("[[Prototype]]") >= 0)
            fail("default mode leaked proto warning to stderr: " + JSON.stringify(err));
        console.log("ok: proto warning silenced by default");

        // 2) IONPOWER_TRACE_PROTO_WARN=1: warning + stack trace.
        runChild({ IONPOWER_TRACE_PROTO_WARN: "1", PATH: process.env.PATH || "" },
            function (code2, out2, err2) {
                ranLoud = true;
                if (code2 !== 0) fail("trace-mode child exit " + code2 + " stderr=" + JSON.stringify(err2));
                if (err2.indexOf("[[Prototype]]") < 0)
                    fail("trace mode did not emit proto warning: " + JSON.stringify(err2));
                if (err2.indexOf("JS stack at warning site") < 0)
                    fail("trace mode did not emit JS stack trace: " + JSON.stringify(err2));
                console.log("ok: proto warning + stack trace emitted under IONPOWER_TRACE_PROTO_WARN=1");
            });
    });

process.on("exit", function () {
    try { fs.unlinkSync(tmp); } catch (e) {}
    if (!ranQuiet) fail("default-mode child never completed");
    if (!ranLoud) fail("trace-mode child never completed");
    console.log("\nproto_warning_filter_smoke: passed");
});
