// Synchronous Promise polyfill smoke.

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Basic resolve.
var r1 = null;
Promise.resolve(42).then(function (v) { r1 = v; });
assert(r1 === 42, "resolve then: " + r1);
console.log("ok: resolve + then");

// Constructor.
var r2 = null;
new Promise(function (resolve) { resolve("hi"); }).then(function (v) { r2 = v; });
assert(r2 === "hi", "ctor resolve: " + r2);
console.log("ok: constructor");

// Reject + catch.
var err = null;
Promise.reject(new Error("nope")).catch(function (e) { err = e; });
assert(err && err.message === "nope", "reject catch: " + err);
console.log("ok: reject catch");

// Chain.
var chained = 0;
Promise.resolve(1)
  .then(function (v) { return v + 2; })
  .then(function (v) { return v * 10; })
  .then(function (v) { chained = v; });
assert(chained === 30, "chain (1+2)*10 = 30; got " + chained);
console.log("ok: chain");

// Promise.all.
var all = null;
Promise.all([Promise.resolve("a"), 2, Promise.resolve(true)])
  .then(function (arr) { all = arr; });
assert(all && all.length === 3 && all[0] === "a" && all[1] === 2 && all[2] === true,
       "all: " + JSON.stringify(all));
console.log("ok: all");

// Promise.race.
var raced = null;
Promise.race([Promise.resolve("winner"), Promise.reject("loser")])
  .then(function (v) { raced = v; });
assert(raced === "winner", "race: " + raced);
console.log("ok: race");

// allSettled.
var settled = null;
Promise.allSettled([Promise.resolve(1), Promise.reject("bad"), Promise.resolve(3)])
  .then(function (arr) { settled = arr; });
assert(settled && settled.length === 3,
       "allSettled count: " + (settled && settled.length));
assert(settled[0].status === "fulfilled" && settled[0].value === 1, "[0] fulfilled");
assert(settled[1].status === "rejected" && settled[1].reason === "bad", "[1] rejected");
console.log("ok: allSettled");

// finally.
var f = { value: null, called: false };
Promise.resolve(7).finally(function () { f.called = true; }).then(function (v) { f.value = v; });
assert(f.called && f.value === 7, "finally runs + forwards value");
console.log("ok: finally");

// Thenable interop.
var thenable = { then: function (resolve) { resolve("thenable value"); } };
var interop = null;
Promise.resolve(thenable).then(function (v) { interop = v; });
assert(interop === "thenable value", "thenable interop: " + interop);
console.log("ok: thenable interop");

console.log("\npromise smoke: all assertions passed");
