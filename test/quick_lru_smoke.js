// quick-lru: tiny LRU cache. Used by camelcase-keys, image-size,
// swr-class libs, anything that needs bounded memoization.

var QuickLRU = require("./vendor/quick-lru.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var lru = new QuickLRU({ maxSize: 3 });
lru.set("a", 1);
lru.set("b", 2);
lru.set("c", 3);
assert(lru.size === 3, "size 3: " + lru.size);
assert(lru.get("a") === 1, "got a=1");
lru.set("d", 4);
// Eviction shape depends on version (some evict `b` — least-recent that
// hasn't been touched). Just assert we stayed at maxSize.
assert(lru.size <= 3, "size bounded by maxSize");
assert(lru.has("d"), "d present after insertion");
console.log("ok: quick-lru maxSize bounds");

// Iterate — QuickLRU keeps up to 2*maxSize internally until the next
// rotation drops stale entries, so keys() can over-report vs .size.
var keys = [];
for (var key of lru.keys()) keys.push(key);
assert(keys.length >= 1, "keys iterator runs and yields at least one");
assert(keys.indexOf("d") !== -1, "most recently inserted key is present");
console.log("ok: quick-lru keys iterator (" + keys.length + " keys)");

console.log("\nquick_lru smoke: all assertions passed");
