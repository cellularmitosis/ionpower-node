// Symbol.dispose / Symbol.asyncDispose + DisposableStack /
// AsyncDisposableStack smoke (ES2026 / Node 22+).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- Symbols exist ----
assert(typeof Symbol.dispose === "symbol", "Symbol.dispose");
assert(typeof Symbol.asyncDispose === "symbol", "Symbol.asyncDispose");
assert(Symbol.dispose !== Symbol.asyncDispose, "distinct");
console.log("ok: Symbol.dispose / Symbol.asyncDispose");

// ---- Custom disposable ----
var disposed = false;
var resource = { [Symbol.dispose]: function () { disposed = true; } };
resource[Symbol.dispose]();
assert(disposed, "manual dispose call");
console.log("ok: custom [Symbol.dispose]() call");

// ---- DisposableStack ----
assert(typeof DisposableStack === "function", "DisposableStack ctor");
var stack = new DisposableStack();
var order = [];

var r1 = { [Symbol.dispose]: function () { order.push("r1"); } };
var r2 = { [Symbol.dispose]: function () { order.push("r2"); } };

stack.use(r1);
stack.use(r2);
stack.defer(function () { order.push("deferred"); });
stack.adopt({ name: "thing" }, function (v) { order.push("adopted:" + v.name); });

assert(stack.disposed === false, "not yet disposed");
stack.dispose();
assert(stack.disposed === true, "disposed");

// LIFO: last-in first-out
eq(order, ["adopted:thing", "deferred", "r2", "r1"], "LIFO disposal order");
console.log("ok: DisposableStack LIFO + use/defer/adopt");

// ---- Throwing disposers don't stop others ----
var stack2 = new DisposableStack();
var ranAll = [];
stack2.defer(function () { ranAll.push("a"); });
stack2.defer(function () { ranAll.push("b"); throw new Error("oops"); });
stack2.defer(function () { ranAll.push("c"); });
stack2.dispose();
eq(ranAll, ["c", "b", "a"], "all disposers run despite throw");
console.log("ok: DisposableStack errors don't abort others");

// ---- move() transfers ownership ----
var s3 = new DisposableStack();
s3.defer(function () { /* shouldn't run */ });
var s4 = s3.move();
assert(s3.disposed === true, "moved-from is disposed flag");
assert(s4.disposed === false, "moved-to is fresh");
s4.dispose();
console.log("ok: DisposableStack.move()");

// ---- AsyncDisposableStack ----
assert(typeof AsyncDisposableStack === "function", "AsyncDisposableStack ctor");

var asyncOrder = [];
var as = new AsyncDisposableStack();
as.use({ [Symbol.asyncDispose]: function () { return Promise.resolve().then(function () { asyncOrder.push("async-1"); }); } });
as.use({ [Symbol.dispose]: function () { asyncOrder.push("sync-2"); } });
as.defer(function () { asyncOrder.push("deferred-3"); });

as.disposeAsync().then(function () {
    eq(asyncOrder, ["deferred-3", "sync-2", "async-1"], "async LIFO");
    assert(as.disposed === true, "asyncDisposed flag");
    console.log("ok: AsyncDisposableStack disposeAsync LIFO");
}).catch(function (e) { console.error("FAIL: asyncDisposeStack", e); process.exit(1); });

console.log("\ndispose smoke: inline registered (1 async test pending)");
