// env-paths: XDG-ish per-platform data/config/cache/log dirs.

var envPathsMod = require("./vendor/env-paths.js");
var envPaths = envPathsMod.default || envPathsMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var paths = envPaths("my-app");
assert(typeof paths === "object", "returns object");
assert(typeof paths.data   === "string" && paths.data.indexOf("my-app") !== -1, "data path: " + paths.data);
assert(typeof paths.config === "string" && paths.config.indexOf("my-app") !== -1, "config path: " + paths.config);
assert(typeof paths.cache  === "string" && paths.cache.indexOf("my-app") !== -1, "cache path: " + paths.cache);
assert(typeof paths.log    === "string" && paths.log.indexOf("my-app") !== -1, "log path: " + paths.log);
assert(typeof paths.temp   === "string" && paths.temp.indexOf("my-app") !== -1, "temp path: " + paths.temp);
console.log("ok: env-paths returns 5 path categories");

// With { suffix: false } — no -nodejs suffix.
var p2 = envPaths("my-app", { suffix: false });
assert(p2.data.indexOf("nodejs") === -1, "suffix:false strips -nodejs: " + p2.data);
console.log("ok: env-paths suffix:false");

console.log("\nenv-paths smoke: all assertions passed");
