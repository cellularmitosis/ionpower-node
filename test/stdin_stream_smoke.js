// process.stdin streaming via ioWatch. Piped stdin:
//   printf "hello\nworld\n" | node stdin_stream_smoke.js

var chunks = [];
var ended = false;

process.stdin.on("data", function (c) { chunks.push(c); });
process.stdin.on("end",  function () { ended = true; });

process.on("exit", function () {
    if (process.stdin.isTTY) {
        console.log("skip: stdin is TTY (run with piped input to test)");
        console.log("\nstdin_stream smoke: skipped");
        return;
    }
    // For piped input, expect chunks and 'end'.
    if (!ended) {
        console.error("FAIL: 'end' never fired");
        process.exit(1);
    }
    var all = Buffer.concat(chunks).toString("utf8");
    if (all !== "hello\nworld\n") {
        console.error("FAIL: stdin contents mismatch: " + JSON.stringify(all));
        process.exit(1);
    }
    console.log("ok: piped stdin streamed and end fired (" + chunks.length + " chunks)");
    console.log("\nstdin_stream smoke: all assertions passed");
});
