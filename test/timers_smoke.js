// timers_smoke.js — exercises setImmediate / setTimeout / clearTimeout.
// Now that we have a real timer queue, setImmediate/setTimeout defer
// until after the current script body returns.

console.log("main start");

setImmediate(function (a, b) {
    console.log("setImmediate fired, args=", a, b);
}, "one", "two");

setTimeout(function () {
    console.log("setTimeout fired");
}, 100);

const id = setTimeout(function () {
    console.log("THIS SHOULD NOT PRINT — cleared");
}, 100);
clearTimeout(id);  // now really cancels the timer

console.log("main end");
// Expected output order:
//   main start
//   main end
//   setImmediate fired, args=  one two
//   setTimeout fired
