// Classic fib — a decent Ion target. The outer timing harness uses fs to
// read a spec, sum the results for a simple checksum, and write a report,
// exercising console / require / fs / path.

const fs   = require("fs");
const path = require("path");

function fib(n) {
    return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const out = [];
const start = Date.now();
for (let n = 0; n <= 32; ++n) {
    out.push("fib(" + n + ") = " + fib(n));
}
const elapsed = Date.now() - start;
out.push("elapsed: " + elapsed + " ms");

console.log(out.join("\n"));

// Write the report alongside the script for provenance.
const where = path.join(path.dirname(process.argv[1]), "fib-report.txt");
fs.writeFileSync(where, out.join("\n") + "\n");
console.log("wrote", where);
