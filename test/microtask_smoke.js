// Microtask queue — Promise / queueMicrotask / process.nextTick
// all defer; Node-style ordering.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- Promise .then fires after synchronous code ---
var order = [];
Promise.resolve("a").then(function (v) { order.push("p:" + v); });
order.push("sync1");
Promise.resolve("b").then(function (v) { order.push("p:" + v); });
order.push("sync2");

// --- queueMicrotask ---
queueMicrotask(function () { order.push("mt"); });
order.push("sync3");

// --- process.nextTick ---
process.nextTick(function () { order.push("nt"); });
order.push("sync4");

// --- Chained .then preserves ordering ---
Promise.resolve("x")
    .then(function (v) { order.push("chain1:" + v); return v + "!"; })
    .then(function (v) { order.push("chain2:" + v); });
order.push("sync5");

// --- Deferred microtask fires before a setTimeout(0) ---
setTimeout(function () { order.push("timeout0"); }, 0);
Promise.resolve().then(function () { order.push("late-mt"); });

process.on("exit", function () {
    // All synchronous pushes come first, in order:
    eq(order.slice(0, 5), ["sync1", "sync2", "sync3", "sync4", "sync5"],
       "sync code runs first");
    // Then microtasks — the two initial .then, then queueMicrotask, nextTick,
    // the chain (two ticks), and the late microtask. Before setTimeout(0).
    var rest = order.slice(5);
    assert(rest.indexOf("timeout0") === rest.length - 1,
           "setTimeout(0) fires last: " + JSON.stringify(rest));
    assert(rest.indexOf("p:a") >= 0 && rest.indexOf("p:b") >= 0,
           "both Promise.resolve.then fired");
    assert(rest.indexOf("mt") >= 0, "queueMicrotask fired");
    assert(rest.indexOf("nt") >= 0, "nextTick fired");
    assert(rest.indexOf("chain1:x") >= 0 && rest.indexOf("chain2:x!") >= 0,
           "chained .then fires both stages");
    assert(rest.indexOf("late-mt") >= 0, "late microtask fired");
    console.log("ok: microtask ordering: " + JSON.stringify(order));

    console.log("\nmicrotask smoke: all assertions passed");
});
