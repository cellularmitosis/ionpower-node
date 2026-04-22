// timers_smoke.js — exercises setImmediate / setTimeout / clearTimeout.
// Ordering is synchronous in ionpower-node (we have no event loop), so
// "after" prints BEFORE "main done", which is the *wrong* order in real
// Node but matches our documented behavior.

console.log("main start");

setImmediate(function (a, b) {
    console.log("setImmediate fired, args=", a, b);
}, "one", "two");

setTimeout(function () {
    console.log("setTimeout fired");
}, 100);

const id = setTimeout(function () {
    console.log("this setTimeout should also fire (no real cancel)");
}, 100);
clearTimeout(id);  // no-op in our impl; the line above will still print

console.log("main end");
