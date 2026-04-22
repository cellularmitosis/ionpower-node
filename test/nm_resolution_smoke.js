// Smoke test: node_modules resolution (bare specifiers).
// The actual test lives under test/mod/nm_root/ — this harness just
// invokes it so `make test` picks it up with the rest.
const fs   = require("fs");
const path = require("path");

// Our require walks UP from the module's own directory, so we need to
// arrange the test entry to live inside a parent whose node_modules/
// contains the package we want. test/mod/nm_root/entry.js is that
// arrangement; we run it via require.
var abs = path.resolve("test/mod/nm_root/entry.js");
// Delegate to our real require() which evaluates entry.js as a module
// with __dirname = .../nm_root, so 'mylib' resolves under nm_root/
// node_modules/.
require(abs);
