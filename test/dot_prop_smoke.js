// dot-prop: get/set/has/delete deeply-nested properties by "a.b.c" key.

var dp = require("./vendor/dot-prop.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var obj = { user: { name: "alice", prefs: { theme: "dark" } }, count: 0 };

// get
eq(dp.get(obj, "user.name"),        "alice",  "get shallow");
eq(dp.get(obj, "user.prefs.theme"), "dark",   "get nested");
eq(dp.get(obj, "missing.path", "default"), "default", "get default");
console.log("ok: dot-prop.get");

// set
dp.set(obj, "user.prefs.lang", "en");
eq(dp.get(obj, "user.prefs.lang"), "en", "set then get");
console.log("ok: dot-prop.set");

// has
assert(dp.has(obj, "user.name") === true, "has existing");
assert(dp.has(obj, "user.missing") === false, "has missing");
console.log("ok: dot-prop.has");

// delete
dp.delete(obj, "user.prefs.theme");
assert(dp.has(obj, "user.prefs.theme") === false, "delete removed");
console.log("ok: dot-prop.delete");

console.log("\ndot-prop smoke: all assertions passed");
