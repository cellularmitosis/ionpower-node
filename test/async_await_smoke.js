// async/await + for-await smoke. Goes through our Babel-on-parse-fail
// fallback (since SM45 doesn't accept the syntax natively).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- async function basics ----
async function add(a, b) {
    return a + b;
}

async function asyncChain() {
    var x = await Promise.resolve(10);
    var y = await Promise.resolve(20);
    return x + y;
}

async function awaitsThen() {
    return await Promise.resolve(42).then(function (v) { return v * 2; });
}

async function rejectsCorrectly() {
    try {
        await Promise.reject(new Error("boom"));
        return "should-not-reach";
    } catch (e) {
        return "caught: " + e.message;
    }
}

// ---- async over events.on iterator (for await) ----
var events = require("events");
async function readThree() {
    var ee = new events.EventEmitter();
    setImmediate(function () { ee.emit("data", "alpha"); });
    setImmediate(function () { ee.emit("data", "bravo"); });
    setImmediate(function () { setImmediate(function () { ee.emit("data", "charlie"); }); });

    var collected = [];
    var iter = events.on(ee, "data");
    for await (var args of iter) {
        collected.push(args[0]);
        if (collected.length === 3) break;
    }
    return collected;
}

// ---- async over WebStreams Readable ----
async function readStream() {
    var rs = new ReadableStream({
        start: function (c) {
            c.enqueue("one");
            c.enqueue("two");
            c.enqueue("three");
            c.close();
        }
    });
    var collected = [];
    for await (var chunk of rs) {
        collected.push(chunk);
    }
    return collected;
}

// Drive everything
Promise.all([
    add(2, 3),
    asyncChain(),
    awaitsThen(),
    rejectsCorrectly(),
    readThree(),
    readStream()
]).then(function (results) {
    eq(results[0], 5, "async add(2,3) === 5");
    eq(results[1], 30, "asyncChain awaits two values");
    eq(results[2], 84, "await over .then chain");
    eq(results[3], "caught: boom", "try/await rejected catches");
    eq(results[4], ["alpha", "bravo", "charlie"], "for-await over events.on");
    eq(results[5], ["one", "two", "three"], "for-await over ReadableStream");
    console.log("ok: async function basics (5 + 5 await ops)");
    console.log("ok: try/await rejection caught");
    console.log("ok: for-await over events.on iterator");
    console.log("ok: for-await over ReadableStream");
    console.log("\nasync_await smoke: all assertions passed");
}).catch(function (e) {
    console.error("FAIL:", e && e.message, e && e.stack);
    process.exit(1);
});
