// Promise polyfill smoke. As of v0.11 Promises fire through the
// microtask queue, so assertions go in process.on('exit') after
// the loop has fully drained.

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var r1 = null;
Promise.resolve(42).then(function (v) { r1 = v; });

var r2 = null;
new Promise(function (resolve) { resolve("hi"); }).then(function (v) { r2 = v; });

var err = null;
Promise.reject(new Error("nope")).catch(function (e) { err = e; });

var chained = 0;
Promise.resolve(1)
  .then(function (v) { return v + 2; })
  .then(function (v) { return v * 10; })
  .then(function (v) { chained = v; });

var all = null;
Promise.all([Promise.resolve("a"), 2, Promise.resolve(true)])
  .then(function (arr) { all = arr; });

var raced = null;
Promise.race([Promise.resolve("winner"), Promise.reject("loser")])
  .then(function (v) { raced = v; });

var settled = null;
Promise.allSettled([Promise.resolve(1), Promise.reject("bad"), Promise.resolve(3)])
  .then(function (arr) { settled = arr; });

var f = { value: null, called: false };
Promise.resolve(7).finally(function () { f.called = true; }).then(function (v) { f.value = v; });

var thenable = { then: function (resolve) { resolve("thenable value"); } };
var interop = null;
Promise.resolve(thenable).then(function (v) { interop = v; });

process.on("exit", function () {
    assert(r1 === 42,                                       "resolve then: " + r1);
    console.log("ok: resolve + then");
    assert(r2 === "hi",                                     "ctor resolve: " + r2);
    console.log("ok: constructor");
    assert(err && err.message === "nope",                   "reject catch: " + err);
    console.log("ok: reject catch");
    assert(chained === 30,                                  "chain (1+2)*10=30; got " + chained);
    console.log("ok: chain");
    assert(all && all.length === 3 && all[0] === "a" && all[1] === 2 && all[2] === true,
           "all: " + JSON.stringify(all));
    console.log("ok: all");
    assert(raced === "winner",                              "race: " + raced);
    console.log("ok: race");
    assert(settled && settled.length === 3,                 "allSettled count");
    assert(settled[0].status === "fulfilled" && settled[0].value === 1, "[0] fulfilled");
    assert(settled[1].status === "rejected" && settled[1].reason === "bad", "[1] rejected");
    console.log("ok: allSettled");
    assert(f.called && f.value === 7,                       "finally runs + forwards value");
    console.log("ok: finally");
    assert(interop === "thenable value",                    "thenable interop: " + interop);
    console.log("ok: thenable interop");
    console.log("\npromise smoke: all assertions passed");
});
