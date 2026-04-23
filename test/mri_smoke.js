// mri: minimist-smaller; Lukeed's flag parser.

var mri = require("./vendor/mri.js");
mri = mri.default || mri;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var parsed = mri(["-n", "alice", "--port", "8080", "--force=true", "leftover"]);
eq(parsed.n, "alice", "short flag");
eq(parsed.port, 8080, "long flag number");
// mri doesn't coerce the string "true"; it comes back as a string unless
// declared boolean in opts.
eq(parsed.force, "true", "--force=true as string");
eq(parsed._, ["leftover"], "positional");
console.log("ok: mri");

// With aliases + defaults.
var p2 = mri(["-v"], {
    alias: { verbose: "v" },
    default: { quiet: false },
    boolean: ["verbose", "quiet"]
});
eq(p2.verbose, true, "alias v->verbose");
eq(p2.v, true, "short still present");
eq(p2.quiet, false, "default respected");
console.log("ok: mri aliases+defaults");

console.log("\nmri smoke: all assertions passed");
