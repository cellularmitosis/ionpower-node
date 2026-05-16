// Verifies that the Babel parse-failure fallback fires for syntax that
// SM45 can't parse — even when the syntax sits inside a function body
// that SM45's lazy parsing would otherwise defer.
//
// The canonical trigger is **object rest in destructuring** (ES2018):
//
//     const { a, ...rest } = obj;   // SM45 parse error: invalid property id
//
// SM45 supports object spread in literals (`{...x}`) but NOT object
// rest in destructuring patterns. Before v1.0 the wrapper
// `(function (exports, ...) { ... })` would compile fine (the outer
// expression parses cleanly) and SM45 would only diagnose the inner
// rest pattern when the function was first called — past our
// require.cpp parse-failure fallback. With lazy parsing disabled,
// the error fires at compile time and Babel lowers it.

var fs   = require('fs');
var path = require('path');
var os   = require('os');

var rand = Math.floor(Math.random() * 1e9);
var dir = path.join(os.tmpdir(), "ion-lazyparse-" + rand);
fs.mkdirSync(dir, { recursive: true });

var modPath = path.join(dir, "rest-pattern.js");
fs.writeFileSync(modPath,
    "function pick(opts) {\n" +
    "  const { a, ...rest } = opts;\n" +
    "  return { picked: a, rest: rest };\n" +
    "}\n" +
    "module.exports = pick;\n");

var pick = require(modPath);
var got = pick({ a: 1, b: 2, c: 3 });
if (got.picked !== 1) {
    console.error("FAIL: pick.a =", got.picked);
    process.exit(1);
}
if (!got.rest || got.rest.b !== 2 || got.rest.c !== 3 || 'a' in got.rest) {
    console.error("FAIL: rest =", JSON.stringify(got.rest));
    process.exit(1);
}

// Cleanup.
try { fs.unlinkSync(modPath); fs.rmdirSync(dir); } catch (e) {}

console.log("babel_lazy_parse_fallback_smoke: object-rest destructuring lowered + works");
