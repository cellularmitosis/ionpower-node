// Regression test for path.resolve('..' segment collapsing).
//
// Pre-fix, our PathResolve concatenated args without ever resolving '..'
// segments — so path.resolve('/foo/bar', '..') returned '/foo/bar/..'
// instead of '/foo'. npm's check-permissions.js iterates
// `path.resolve(dir, '..')` to walk up directories looking for a
// writable ancestor; with no '..' collapsing the path grows forever
// until our PATH_MAX guard throws "path.resolve: overflow".

var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(actual, expected, msg) {
    if (actual !== expected) {
        console.error("FAIL:", msg, "expected", JSON.stringify(expected), "got", JSON.stringify(actual));
        process.exit(1);
    }
}

// Single '..'
eq(path.resolve("/foo/bar", ".."),       "/foo",            "/foo/bar then ..");
eq(path.resolve("/foo/bar/baz", "../.."), "/foo",            "/foo/bar/baz then ../..");
eq(path.resolve("/a/b/c/d", "../../e"),  "/a/b/e",          "trailing positive after ..");

// Root cap: '/..' stays '/'.
eq(path.resolve("/", ".."),              "/",               "/.. = /");
eq(path.resolve("/", "../..", ".."),     "/",               "many .. at root = /");

// Relative-style mixed args.
eq(path.resolve("/x/y", "z", ".."),      "/x/y",            "/x/y + z + .. = /x/y");
eq(path.resolve("/x/y", "z", "../.."),   "/x",              "/x/y + z + ../.. = /x");

// Absolute later arg resets.
eq(path.resolve("/foo", "/bar/baz", ".."), "/bar",          "absolute resets, then ..");

// './' segments (already covered by old normalize but verify still works).
eq(path.resolve("/foo/./bar"),           "/foo/bar",        "single dot collapsed");
eq(path.resolve("/foo//bar"),            "/foo/bar",        "double slash collapsed");

// findNearestDir-style walk: should terminate quickly at root.
var dir = "/Users/macuser/tmp/npm-test/node_modules/some-dep";
for (var i = 0; i < 20; ++i) {
    var next = path.resolve(dir, "..");
    if (next === dir) break;
    dir = next;
}
eq(dir, "/", "findNearestDir walk terminates at /");

console.log("path_resolve_dotdot smoke: all assertions passed");
