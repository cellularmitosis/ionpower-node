// Demo: use @babel/standalone to transpile a modern library's source
// on-the-fly, then eval it as a CJS module.
//
// This closes the loop — it means "can't parse ?." isn't really a
// hard wall; libraries that use it can be loaded via this pattern.

const fs    = require("fs");
const Babel = require("./vendor/babel.js");

// A synthetic "modern" module source using optional chaining, nullish
// coalescing, and class fields — features our runtime rejects at parse.
var modernSrc = [
    "'use strict';",
    "class Config {",
    "  constructor(opts) {",
    "    this.host = opts?.host ?? 'localhost';",
    "    this.port = opts?.port ?? 8080;",
    "  }",
    "  url() { return `http://${this.host}:${this.port}`; }",
    "}",
    "module.exports = {",
    "  Config: Config,",
    "  make: function (opts) { return new Config(opts); }",
    "};"
].join("\n");

// First, show our parser rejects this raw:
var raw_failed = false;
try {
    new Function(modernSrc);
} catch (e) {
    raw_failed = true;
    console.log("raw parse fails as expected:", e.message.slice(0, 60));
}
if (!raw_failed) { console.error("FAIL: expected SyntaxError on modern syntax"); process.exit(1); }

// Now transpile through Babel.
var t0 = Date.now();
var transpiled = Babel.transform(modernSrc, { presets: ["env"] }).code;
console.log("babel transpile:", (Date.now() - t0), "ms");
console.log("----- transpiled source -----");
console.log(transpiled);
console.log("-----------------------------");

// Wrap in a CJS factory and eval.
var mod = { exports: {} };
(function (module, exports) { eval(transpiled); })(mod, mod.exports);

// Use the transpiled module.
var cfg = mod.exports.make();
console.log("default url:", cfg.url());
if (cfg.url() !== "http://localhost:8080") { console.error("FAIL: default url"); process.exit(1); }

var cfg2 = mod.exports.make({ host: "imacg52", port: 9000 });
console.log("custom  url:", cfg2.url());
if (cfg2.url() !== "http://imacg52:9000") { console.error("FAIL: custom url"); process.exit(1); }

var cfg3 = mod.exports.make({ port: 1234 });  // no host, should default
console.log("partial url:", cfg3.url());
if (cfg3.url() !== "http://localhost:1234") { console.error("FAIL: partial url"); process.exit(1); }

console.log("\nbabel_load_modern: modern JS round-tripped through babel runs correctly");
