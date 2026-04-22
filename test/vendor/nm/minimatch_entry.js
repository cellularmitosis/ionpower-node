var minimatch = require("minimatch");

function ok(label, cond) {
    if (cond) console.log("ok: " + label);
    else { console.error("FAIL: " + label); process.exit(1); }
}

// Classic glob tests from the minimatch README.
ok("*.js matches foo.js",       minimatch("foo.js", "*.js"));
ok("*.js rejects foo.ts",      !minimatch("foo.ts", "*.js"));

ok("**/foo matches a/b/foo",    minimatch("a/b/foo", "**/foo"));
ok("**/foo matches foo",        minimatch("foo", "**/foo"));

ok("?.js matches f.js",         minimatch("f.js", "?.js"));
ok("?.js rejects foo.js",      !minimatch("foo.js", "?.js"));

ok("{foo,bar}.js matches foo", minimatch("foo.js", "{foo,bar}.js"));
ok("{foo,bar}.js matches bar", minimatch("bar.js", "{foo,bar}.js"));
ok("{foo,bar}.js rejects baz",!minimatch("baz.js", "{foo,bar}.js"));

ok("[abc].js matches a.js",    minimatch("a.js", "[abc].js"));
ok("[abc].js rejects d.js",   !minimatch("d.js", "[abc].js"));

ok("brace expansion",           minimatch("file.md", "*.{js,md,txt}"));

// Negation via options.
ok("dot not matched w/o dot", !minimatch(".hidden", "*"));
ok("dot matched with dot",     minimatch(".hidden", "*", { dot: true }));

console.log("\nminimatch smoke: all assertions passed");
