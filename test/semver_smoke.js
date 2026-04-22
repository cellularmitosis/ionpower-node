// Smoke test: semver on ionpower-node.
// Lots of regex work (version string matching) and a small state machine.

const semver = require("./vendor/semver.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else    { failed++; console.error("FAIL: " + label +
                                      "\n  got:  " + JSON.stringify(got) +
                                      "\n  want: " + JSON.stringify(want)); }
}

// Basic parse
var p = new semver.SemVer("1.2.3-beta.4+meta");
eq("major",       p.major,      1);
eq("minor",       p.minor,      2);
eq("patch",       p.patch,      3);
eq("prerelease",  p.prerelease, ["beta", 4]);
eq("build",       p.build,      ["meta"]);

// Validity
eq("valid ok",     semver.valid("1.0.0"),       "1.0.0");
eq("valid fail",   semver.valid("not-a-ver"),   null);

// Comparison
eq("lt",     semver.lt("1.2.3", "1.2.4"),     true);
eq("gt",     semver.gt("2.0.0", "1.9.9"),     true);
eq("eq",     semver.eq("1.0.0", "1.0.0"),     true);
eq("rcompare sorts low..high", ["1.2.0", "1.0.0", "1.10.0", "1.2.5"].sort(semver.compare),
   ["1.0.0", "1.2.0", "1.2.5", "1.10.0"]);

// Range satisfaction
eq("~1.2.3 satisfies 1.2.9", semver.satisfies("1.2.9", "~1.2.3"),  true);
eq("~1.2.3 blocks 1.3.0",    semver.satisfies("1.3.0", "~1.2.3"),  false);
eq("^1.2.3 satisfies 1.9.9", semver.satisfies("1.9.9", "^1.2.3"),  true);
eq("^1.2.3 blocks 2.0.0",    semver.satisfies("2.0.0", "^1.2.3"),  false);
eq(">=1.0.0 <2.0.0 satisfies 1.5.0",
   semver.satisfies("1.5.0", ">=1.0.0 <2.0.0"), true);

// Increment
eq("inc patch", semver.inc("1.2.3", "patch"),  "1.2.4");
eq("inc minor", semver.inc("1.2.3", "minor"),  "1.3.0");
eq("inc major", semver.inc("1.2.3", "major"),  "2.0.0");
eq("inc prerelease", semver.inc("1.2.3", "prerelease", "rc"), "1.2.4-rc.0");

// Coerce
eq("coerce",    semver.coerce("v2.0.0-rc.1 extra").version, "2.0.0");
eq("coerce bad", semver.coerce("not a version"), null);

console.log("\nsemver smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
