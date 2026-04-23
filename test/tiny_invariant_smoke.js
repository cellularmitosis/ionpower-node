// tiny-invariant: a tiny, thrown-Error invariant helper.

var invariant = require("./vendor/tiny-invariant.js");
invariant = invariant.default || invariant;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Truthy: no throw.
var threwTruthy = false;
try { invariant(true, "shouldn't throw"); } catch (e) { threwTruthy = true; }
assert(!threwTruthy, "truthy should not throw");
console.log("ok: truthy passes silently");

// Falsy: throws with message.
var caught = null;
try { invariant(false, "intentional"); } catch (e) { caught = e; }
assert(caught instanceof Error, "falsy throws Error");
assert(String(caught.message).indexOf("intentional") >= 0,
       "msg carried: " + caught.message);
console.log("ok: falsy throws Error with message");

console.log("\ntiny-invariant smoke: all assertions passed");
