// AsyncLocalStorage smoke. Per-context store propagation across
// microtask / setTimeout / Promise chain boundaries.

var ah = require("async_hooks");
var AsyncLocalStorage = ah.AsyncLocalStorage;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

assert(typeof AsyncLocalStorage === "function", "AsyncLocalStorage ctor");

// ---- run / getStore (synchronous) ----
var als = new AsyncLocalStorage();
var captured;

als.run({ user: "alice" }, function () {
    captured = als.getStore();
});
eq(captured, { user: "alice" }, "run() establishes store inside callback");
assert(als.getStore() === undefined, "getStore() outside run is undefined");
console.log("ok: ALS sync run + getStore");

// ---- propagation across Promise.then ----
als.run({ user: "bob" }, function () {
    Promise.resolve().then(function () {
        var store = als.getStore();
        assert(store && store.user === "bob", "Promise.then sees outer store");
        return Promise.resolve();
    }).then(function () {
        var store = als.getStore();
        assert(store && store.user === "bob", "second .then still sees store");
    }).then(function () {
        console.log("ok: ALS propagates across Promise.then chain");
    }).catch(function (e) { console.error("FAIL: Promise propagation", e); process.exit(1); });
});

// ---- propagation across setTimeout ----
als.run({ user: "charlie" }, function () {
    setTimeout(function () {
        var store = als.getStore();
        assert(store && store.user === "charlie", "setTimeout sees outer store");
        console.log("ok: ALS propagates across setTimeout");
    }, 30);
});

// ---- propagation across setImmediate ----
als.run({ user: "delta" }, function () {
    setImmediate(function () {
        var store = als.getStore();
        assert(store && store.user === "delta", "setImmediate sees outer store");
        console.log("ok: ALS propagates across setImmediate");
    });
});

// ---- multiple parallel contexts isolate ----
var seenA, seenB;
function inA() {
    return new Promise(function (resolve) {
        setTimeout(function () { seenA = als.getStore(); resolve(); }, 20);
    });
}
function inB() {
    return new Promise(function (resolve) {
        setTimeout(function () { seenB = als.getStore(); resolve(); }, 20);
    });
}
Promise.all([
    new Promise(function (resolve) { als.run({ id: "A" }, function () { resolve(inA()); }); }),
    new Promise(function (resolve) { als.run({ id: "B" }, function () { resolve(inB()); }); })
]).then(function () {
    assert(seenA && seenA.id === "A", "context A isolated");
    assert(seenB && seenB.id === "B", "context B isolated");
    console.log("ok: ALS parallel contexts don't bleed");
});

// ---- exit() temporarily clears store ----
als.run({ user: "echo" }, function () {
    eq(als.getStore(), { user: "echo" }, "inside run");
    als.exit(function () {
        assert(als.getStore() === undefined, "exit clears store");
    });
    eq(als.getStore(), { user: "echo" }, "store restored after exit");
    console.log("ok: ALS exit() clears + restores");
});

// ---- AsyncResource shape ----
var AsyncResource = ah.AsyncResource;
assert(typeof AsyncResource === "function", "AsyncResource ctor");
var r = new AsyncResource("MyTask");
assert(typeof r.runInAsyncScope === "function", "runInAsyncScope");
assert(r.asyncId() > 0, "asyncId > 0");
console.log("ok: AsyncResource shape");

console.log("\nasync_local_storage smoke: inline registered (4 async assertions pending)");
