// node:test t.mock surface: fn, method, getter, setter, restoreAll.

var test = require("node:test");

test("mock.fn tracks calls + arguments", function (t) {
    var spy = t.mock.fn(function (a, b) { return a + b; });
    if (spy(2, 3) !== 5) throw new Error("mock.fn forwards to impl");
    if (spy(10, 20) !== 30) throw new Error("mock.fn forwards twice");
    if (spy.mock.callCount() !== 2) throw new Error("callCount = 2");
    if (spy.mock.calls[0].arguments[0] !== 2) throw new Error("first arg recorded");
    if (spy.mock.calls[1].result !== 30) throw new Error("result recorded");
    spy.mock.resetCalls();
    if (spy.mock.callCount() !== 0) throw new Error("resetCalls clears");
});

test("mock.fn captures thrown errors", function (t) {
    var spy = t.mock.fn(function () { throw new Error("oops"); });
    var threw = false;
    try { spy(); } catch (e) { threw = true; }
    if (!threw) throw new Error("error rethrown");
    if (spy.mock.callCount() !== 1) throw new Error("call recorded despite throw");
    if (!spy.mock.calls[0].error) throw new Error(".error attached");
    if (spy.mock.calls[0].error.message !== "oops") throw new Error("error message");
});

test("mock.fn() with no args is a noop spy", function (t) {
    var spy = t.mock.fn();
    spy(1, 2, 3);
    if (spy.mock.callCount() !== 1) throw new Error("noop spy still tracks");
    if (spy.mock.calls[0].arguments.length !== 3) throw new Error("args recorded");
});

test("mock.method replaces + auto-restores at test end", function (t) {
    var obj = { greet: function (n) { return "hi " + n; } };
    var orig = obj.greet;
    var mock = t.mock.method(obj, "greet", function (n) { return "MOCKED " + n; });
    if (obj.greet("alice") !== "MOCKED alice") throw new Error("method replaced");
    if (mock.mock.callCount() !== 1) throw new Error("method call tracked");
    if (mock.mock.calls[0].arguments[0] !== "alice") throw new Error("arg recorded");

    // Manual restore
    mock.mock.restore();
    if (obj.greet !== orig) throw new Error("method restored manually");
    if (obj.greet("bob") !== "hi bob") throw new Error("original works after restore");
});

test("mock.getter intercepts property reads", function (t) {
    var obj = { _x: 42 };
    Object.defineProperty(obj, "x", { get: function () { return this._x; }, configurable: true });
    var initial = obj.x;
    if (initial !== 42) throw new Error("baseline getter works");

    var mockGetter = t.mock.getter(obj, "x", function () { return 99; });
    if (obj.x !== 99) throw new Error("getter mocked");
    if (mockGetter.mock.callCount() !== 1) throw new Error("getter call tracked");
});

test("mock.setter intercepts property writes", function (t) {
    var obj = {};
    var lastSet = null;
    Object.defineProperty(obj, "y", {
        set: function (v) { lastSet = v; },
        configurable: true
    });
    obj.y = 1;
    if (lastSet !== 1) throw new Error("baseline setter works");

    var mockSetter = t.mock.setter(obj, "y", function (v) { /* swallow */ });
    obj.y = 99;
    if (lastSet === 99) throw new Error("setter mocked (lastSet should not have changed)");
    if (mockSetter.mock.callCount() !== 1) throw new Error("setter call tracked");
});

test("mock.method auto-restores between tests (verify in next test)", function (t) {
    globalThis._sharedObj = globalThis._sharedObj || { fn: function () { return "real"; } };
    t.mock.method(globalThis._sharedObj, "fn", function () { return "fake"; });
    if (globalThis._sharedObj.fn() !== "fake") throw new Error("mock works in this test");
});

test("auto-restore from previous test took effect", function (t) {
    if (globalThis._sharedObj.fn() !== "real") {
        throw new Error("expected real impl after auto-restore, got " + globalThis._sharedObj.fn());
    }
});

test("mock.fn mockImplementation switches behavior", function (t) {
    var spy = t.mock.fn(function () { return "v1"; });
    if (spy() !== "v1") throw new Error("initial impl");
    spy.mock.mockImplementation(function () { return "v2"; });
    if (spy() !== "v2") throw new Error("impl switched");
});
