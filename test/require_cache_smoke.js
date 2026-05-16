// Smoke: require.cache must be a live object on every per-module
// require function. Several modern Node packages (meow does this
// specifically: `delete require.cache[__filename]` in
// node_modules/meow/index.js) reach for require.cache at module
// load to opt out of caching. Pre-v1.0 require.cache was undefined,
// so those packages threw at load with "cannot delete property of
// undefined".

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

assert(typeof require.cache === 'object' && require.cache !== null,
       "require.cache should be an object, got " + typeof require.cache);

// Loading a child module should populate require.cache at the
// resolved file path of that child.
var fs   = require('fs');
var path = require('path');
var os   = require('os');

var rand = Math.floor(Math.random() * 1e9);
var root = path.join(os.tmpdir(), "ion-require-cache-" + rand);
fs.mkdirSync(root, { recursive: true });
var childPath = path.join(root, "cache_target.js");
fs.writeFileSync(childPath, "module.exports = { tag: 'first', n: 1 };\n");

var keysBefore = Object.keys(require.cache).length;
var first = require(childPath);
assert(first && first.tag === 'first',
       "first require should return module.exports");

var keysAfter = Object.keys(require.cache).length;
assert(keysAfter > keysBefore,
       "require.cache should gain an entry after first require");
assert(require.cache[childPath] !== undefined,
       "require.cache[absPath] should be defined for a loaded module");

// Mutate the source and delete the cache entry — second require
// should re-execute and return the new exports (Node's documented
// behavior, and what meow relies on).
fs.writeFileSync(childPath, "module.exports = { tag: 'second', n: 2 };\n");

delete require.cache[childPath];
assert(require.cache[childPath] === undefined,
       "delete require.cache[path] should remove the entry");

var second = require(childPath);
assert(second && second.tag === 'second' && second.n === 2,
       "after cache delete + source change, second require should " +
       "return the new module.exports, got " + JSON.stringify(second));

// Cleanup
try { fs.unlinkSync(childPath); fs.rmdirSync(root); } catch (e) {}

console.log("OK require.cache populates, exposes file-path keys, " +
            "and delete causes re-execution");
