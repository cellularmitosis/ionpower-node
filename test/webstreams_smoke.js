// WebStreams smoke — ReadableStream / WritableStream / TransformStream.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Constructors exist on the global.
assert(typeof ReadableStream  === "function", "ReadableStream ctor");
assert(typeof WritableStream  === "function", "WritableStream ctor");
assert(typeof TransformStream === "function", "TransformStream ctor");

// --- ReadableStream: enqueue in start(), read all ---
(function () {
    var rs = new ReadableStream({
        start: function (c) {
            c.enqueue("a"); c.enqueue("b"); c.enqueue("c"); c.close();
        }
    });
    var reader = rs.getReader();
    var out = [];
    function loop() {
        return reader.read().then(function (r) {
            if (r.done) return;
            out.push(r.value);
            return loop();
        });
    }
    loop().then(function () {
        eq(out, ["a","b","c"], "ReadableStream basic read");
        console.log("ok: ReadableStream basic read");
    }).catch(function (e) { console.error("FAIL: basic read", e); process.exit(1); });
})();

// --- ReadableStream: pull-based source (lazy enqueue) ---
(function () {
    var n = 0;
    var rs = new ReadableStream({
        pull: function (c) {
            n++;
            c.enqueue(n);
            if (n >= 5) c.close();
        }
    });
    var reader = rs.getReader();
    var out = [];
    function loop() {
        return reader.read().then(function (r) {
            if (r.done) return;
            out.push(r.value);
            return loop();
        });
    }
    loop().then(function () {
        eq(out, [1,2,3,4,5], "ReadableStream pull");
        console.log("ok: ReadableStream pull");
    }).catch(function (e) { console.error("FAIL: pull", e); process.exit(1); });
})();

// --- ReadableStream: error() propagates to reader.read() ---
(function () {
    var rs = new ReadableStream({
        start: function (c) { c.error(new Error("boom")); }
    });
    var reader = rs.getReader();
    reader.read().then(function () {
        console.error("FAIL: expected error"); process.exit(1);
    }, function (e) {
        assert(e && /boom/.test(e.message), "error propagated");
        console.log("ok: ReadableStream error propagation");
    });
})();

// --- ReadableStream: locked flag + double getReader throws ---
(function () {
    var rs = new ReadableStream({ start: function (c) { c.close(); } });
    assert(rs.locked === false, "initially unlocked");
    var r = rs.getReader();
    assert(rs.locked === true, "locked after getReader");
    var threw = false;
    try { rs.getReader(); } catch (e) { threw = true; }
    assert(threw, "second getReader throws");
    r.releaseLock();
    assert(rs.locked === false, "unlocked after releaseLock");
    console.log("ok: ReadableStream lock/unlock");
})();

// --- WritableStream: write() serializes to sink in order ---
(function () {
    var written = [];
    var ws = new WritableStream({
        write: function (chunk) { written.push(chunk); }
    });
    var w = ws.getWriter();
    Promise.all([w.write("x"), w.write("y"), w.write("z")]).then(function () {
        return w.close();
    }).then(function () {
        eq(written, ["x","y","z"], "WritableStream in-order write");
        console.log("ok: WritableStream write + close");
    }).catch(function (e) { console.error("FAIL: ws write", e); process.exit(1); });
})();

// --- TransformStream: uppercase transformer ---
(function () {
    var up = new TransformStream({
        transform: function (chunk, c) { c.enqueue(chunk.toUpperCase()); }
    });
    var reader = up.readable.getReader();
    var writer = up.writable.getWriter();
    writer.write("hello"); writer.write("world");
    writer.close();

    var out = [];
    function loop() {
        return reader.read().then(function (r) {
            if (r.done) return;
            out.push(r.value);
            return loop();
        });
    }
    loop().then(function () {
        eq(out, ["HELLO","WORLD"], "TransformStream uppercase");
        console.log("ok: TransformStream");
    }).catch(function (e) { console.error("FAIL: transform", e); process.exit(1); });
})();

// --- pipeTo: a readable into a writable, full round-trip ---
(function () {
    var rs = new ReadableStream({
        start: function (c) { c.enqueue(1); c.enqueue(2); c.enqueue(3); c.close(); }
    });
    var collected = [];
    var ws = new WritableStream({
        write: function (chunk) { collected.push(chunk); }
    });
    rs.pipeTo(ws).then(function () {
        eq(collected, [1,2,3], "pipeTo collected");
        console.log("ok: pipeTo");
    }).catch(function (e) { console.error("FAIL: pipeTo", e); process.exit(1); });
})();

// --- pipeThrough: chain a source through a transform ---
(function () {
    var rs = new ReadableStream({
        start: function (c) { c.enqueue(2); c.enqueue(3); c.enqueue(4); c.close(); }
    });
    var doubler = new TransformStream({
        transform: function (chunk, c) { c.enqueue(chunk * 2); }
    });
    var out = [];
    var sink = new WritableStream({
        write: function (chunk) { out.push(chunk); }
    });
    rs.pipeThrough(doubler).pipeTo(sink).then(function () {
        eq(out, [4,6,8], "pipeThrough doubler");
        console.log("ok: pipeThrough");
    }).catch(function (e) { console.error("FAIL: pipeThrough", e); process.exit(1); });
})();

// --- tee(): two readers see the same bytes ---
(function () {
    var rs = new ReadableStream({
        start: function (c) { c.enqueue("x"); c.enqueue("y"); c.close(); }
    });
    var branches = rs.tee();
    var r1 = branches[0].getReader();
    var r2 = branches[1].getReader();
    var a = [], b = [];
    function drain(reader, sink) {
        return reader.read().then(function (r) {
            if (r.done) return;
            sink.push(r.value);
            return drain(reader, sink);
        });
    }
    Promise.all([drain(r1, a), drain(r2, b)]).then(function () {
        eq(a, ["x","y"], "tee branch 0");
        eq(b, ["x","y"], "tee branch 1");
        console.log("ok: tee");
    }).catch(function (e) { console.error("FAIL: tee", e); process.exit(1); });
})();

process.on("exit", function () {
    console.log("\nwebstreams smoke: done");
});
