// Event-loop smoke: wallclock timers should actually wait.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Timer ordering was correct in v0.7 but timing was not. Now setTimeout(fn, N)
// should block the loop for ~N ms.
var start = Date.now();
setTimeout(function () {
    var elapsed = Date.now() - start;
    // Tolerate a little scheduler drift — we want at least 100ms, not much more.
    assert(elapsed >= 100, "setTimeout(100) waited at least 100ms (got " + elapsed + ")");
    assert(elapsed <  500, "setTimeout(100) didn't over-sleep (got " + elapsed + ")");
    console.log("ok: setTimeout wallclock (elapsed " + elapsed + "ms)");
}, 100);

// Multiple timers fire in fireAt order.
var fired = [];
setTimeout(function () { fired.push("B"); }, 40);
setTimeout(function () { fired.push("A"); }, 20);
setTimeout(function () {
    assert(fired.length === 2, "two prior timers fired");
    assert(fired[0] === "A", "earlier timer first");
    assert(fired[1] === "B", "later timer second");
    console.log("ok: timer ordering across loop iterations");
}, 80);

// setImmediate fires before a 10ms timeout (setImmediate = 0ms).
var order = [];
setTimeout(function () { order.push("timeout"); }, 10);
setImmediate(function () { order.push("immediate"); });
setTimeout(function () {
    // setImmediate vs setTimeout(10) — immediate has fireAt=now+0, timeout=now+10.
    // Both have fired by now.
    assert(order.length === 2, "both fired");
    assert(order[0] === "immediate", "setImmediate before 10ms timeout");
    console.log("ok: setImmediate vs setTimeout");
}, 40);

// clearTimeout cancels a pending timer.
var cancelled = false;
var t = setTimeout(function () { cancelled = true; }, 30);
clearTimeout(t);
setTimeout(function () {
    assert(!cancelled, "clearTimeout prevented fire");
    console.log("ok: clearTimeout");
}, 60);

process.on("exit", function () {
    console.log("\nevent_loop smoke: all assertions passed");
});
