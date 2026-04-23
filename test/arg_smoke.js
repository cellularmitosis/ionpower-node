// arg: tiny CLI argument parser (vercel/arg).

var arg = require("./vendor/arg.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var spec = {
    "--help":    Boolean,
    "--name":    String,
    "--port":    Number,
    "-h":        "--help",
    "-n":        "--name",
    "-p":        "--port",
};

var argv = ["-n", "alice", "--port", "8080", "--help", "leftover"];
var parsed = arg(spec, { argv: argv });
eq(parsed["--name"], "alice", "name");
eq(parsed["--port"], 8080, "port");
eq(parsed["--help"], true, "help flag");
eq(parsed._, ["leftover"], "positional");
console.log("ok: 4 fields parsed");

console.log("\narg smoke: all assertions passed");
