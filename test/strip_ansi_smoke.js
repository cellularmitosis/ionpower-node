// Smoke test: strip-ansi (remove ANSI escapes) on ionpower-node.
// First test that exercises node_modules resolution against a REAL
// npm package tree (strip-ansi -> ansi-regex, both in test/vendor/nm/).

const path = require("path");
// Run from a cwd that has test/vendor/nm/node_modules/ as ancestor.
// We re-require with an absolute path so the require loader walks up
// from test/vendor/nm/ and finds node_modules there.
var entry = path.resolve("test/vendor/nm/entry.js");
require(entry);
