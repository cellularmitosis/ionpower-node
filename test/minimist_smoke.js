// Smoke test: minimist (tiny argv parser) on ionpower-node.
const parseArgs = require("./vendor/minimist.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else    { failed++; console.error("FAIL: " + label +
                                      "\n  got:  " + JSON.stringify(got) +
                                      "\n  want: " + JSON.stringify(want)); }
}

// Positional
eq("positional only",
   parseArgs(["a", "b"]),
   { _: ["a", "b"] });

// Long flags (bool + string)
eq("--flag",
   parseArgs(["--verbose"]),
   { _: [], verbose: true });
eq("--key value",
   parseArgs(["--name", "alice"]),
   { _: [], name: "alice" });
eq("--key=value",
   parseArgs(["--name=bob"]),
   { _: [], name: "bob" });

// Short flags
eq("-v",      parseArgs(["-v"]),      { _: [], v: true });
eq("-n 5",    parseArgs(["-n", "5"]), { _: [], n: 5 });

// Negation (--no-)
eq("--no-color",
   parseArgs(["--no-color"]),
   { _: [], color: false });

// Combined with opts (need `boolean: "v"` otherwise minimist thinks
// -v takes a value).
eq("with alias + default",
   parseArgs(["-v", "foo"],
             { alias: { v: "verbose" }, boolean: ["v"], default: { out: "-" } }),
   { _: ["foo"], v: true, verbose: true, out: "-" });

// String-typed option (prevent numeric coercion)
eq("string-typed value",
   parseArgs(["--version", "1.0"], { string: "version" }),
   { _: [], version: "1.0" });

console.log("\nminimist smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
