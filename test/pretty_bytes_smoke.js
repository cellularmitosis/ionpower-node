// pretty-bytes: human-readable byte sizes.

var prettyBytes = require("./vendor/pretty-bytes.js");

function eq(actual, expected, msg) {
    if (actual !== expected) {
        console.error("FAIL:", msg, "expected", JSON.stringify(expected), "got", JSON.stringify(actual));
        process.exit(1);
    }
}

eq(prettyBytes(0), "0 B", "zero");
eq(prettyBytes(1024), "1.02 kB", "1024");
eq(prettyBytes(1e6), "1 MB", "1M");
eq(prettyBytes(1e9), "1 GB", "1G");
eq(prettyBytes(-1337), "-1.34 kB", "negative");
eq(prettyBytes(1e6, { bits: true }), "1 Mbit", "bits");
console.log("ok: 6 pretty-bytes forms");

console.log("\npretty-bytes smoke: all assertions passed");
