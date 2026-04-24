// Async child_process.spawn / exec — uses the real event loop.

var cp = require("child_process");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- spawn: echo one two ---
var spawnOutputs = [];
var spawnExit = null;
var sp = cp.spawn("echo", ["one", "two"]);
sp.stdout.on("data", function (d) { spawnOutputs.push(String(d)); });
sp.on("exit", function (code) { spawnExit = code; });

// --- exec: tr a-z A-Z < "hello" ---
var execErr = null, execOut = null;
cp.exec("printf abc | tr a-z A-Z", function (err, stdout) {
    execErr = err;
    execOut = stdout;
});

// --- spawn with stderr ---
var stderrGot = "";
var spErrExit = null;
var sp2 = cp.spawn("sh", ["-c", "echo oops 1>&2; exit 5"]);
sp2.stderr.on("data", function (d) { stderrGot += String(d); });
sp2.on("exit", function (code) { spErrExit = code; });

// --- spawn with stdin input ---
var stdinOut = "";
var sp3 = cp.spawn("cat", []);
sp3.stdout.on("data", function (d) { stdinOut += String(d); });
sp3.stdin.write("hello via stdin\n");
sp3.stdin.end();
var sp3Exit = null;
sp3.on("exit", function (code) { sp3Exit = code; });

// Validate at exit. The event loop will run all pending work before
// process.on('exit') fires.
process.on("exit", function () {
    // spawn echo
    var allOut = spawnOutputs.join("").replace(/\s+$/, "");
    eq(allOut, "one two", "spawn stdout");
    eq(spawnExit, 0, "spawn exit code");
    console.log("ok: async spawn echo");

    // exec tr
    assert(execErr === null, "exec no error");
    eq(String(execOut), "ABC", "exec stdout");
    console.log("ok: async exec pipe");

    // spawn stderr + non-zero exit
    assert(stderrGot.indexOf("oops") >= 0, "stderr captured");
    eq(spErrExit, 5, "spawn exit 5");
    console.log("ok: async spawn stderr + nonzero");

    // spawn stdin
    eq(stdinOut, "hello via stdin\n", "cat stdin->stdout");
    eq(sp3Exit, 0, "cat exit 0");
    console.log("ok: async spawn stdin");

    console.log("\nasync_child_process smoke: all assertions passed");
});
