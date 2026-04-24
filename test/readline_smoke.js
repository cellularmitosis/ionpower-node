// readline smoke: piped stdin drives line-by-line read.
// Uses spawnSync to pipe known text, then verifies the child read
// them one line at a time via readline.

var child_process = require("child_process");
var fs = require("fs");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Child script: reads lines from stdin via readline, echoes each
// prefixed with "> ", closes on 'close' event, prints a trailer.
var childSrc = "var readline = require('readline');\n" +
    "var rl = readline.createInterface({ input: process.stdin });\n" +
    "var n = 0;\n" +
    "rl.on('line', function (line) { n++; console.log('> ' + line); });\n" +
    "rl.on('close', function () { console.log('END:' + n); });\n";

// Write the child script to a temp file.
var tmp = "/tmp/readline_child_" + process.pid + ".js";
fs.writeFileSync(tmp, childSrc);

try {
    var input = "alpha\nbravo\ncharlie\ndelta\n";
    var nodeBin = process.argv[0];
    var result = child_process.spawnSync(nodeBin, [tmp], { input: input, encoding: "utf8" });

    if (result.error) { console.error("FAIL: spawn", result.error); process.exit(1); }
    if (result.status !== 0) {
        console.error("FAIL: child exit", result.status, "stderr:", result.stderr);
        process.exit(1);
    }

    var lines = result.stdout.split("\n").filter(function (l) { return l.length; });
    assert(lines.length === 5, "child produced 4 echoed lines + END: (got " + lines.length + ")");
    assert(lines[0] === "> alpha",  "line 1");
    assert(lines[1] === "> bravo",  "line 2");
    assert(lines[2] === "> charlie","line 3");
    assert(lines[3] === "> delta",  "line 4");
    assert(lines[4] === "END:4",    "END: event with count 4");
    console.log("ok: readline line-by-line read over piped stdin");

    // readline.cursorTo / clearLine should be no-ops on non-TTY streams.
    var readline = require("readline");
    var calls = 0;
    var fakeStream = { isTTY: false, write: function () { calls++; } };
    readline.cursorTo(fakeStream, 5);
    readline.clearLine(fakeStream, 0);
    readline.moveCursor(fakeStream, 1, 1);
    assert(calls === 0, "cursor/clear/move are no-op on non-TTY");

    // On TTY, they emit escapes
    var writes = [];
    var ttyStream = { isTTY: true, write: function (s) { writes.push(s); } };
    readline.cursorTo(ttyStream, 0);
    assert(writes[0] === "\u001b[1G", "cursorTo(0) emits CSI 1G, got " + JSON.stringify(writes[0]));
    readline.clearLine(ttyStream, 0);
    assert(writes[1] === "\u001b[2K", "clearLine emits CSI 2K, got " + JSON.stringify(writes[1]));
    console.log("ok: readline TTY escape codes");

} finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
}

console.log("\nreadline smoke: all assertions passed");
