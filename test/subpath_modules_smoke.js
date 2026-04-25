// Subpath module aliases (v0.70):
//   - fs/promises, node:fs/promises
//   - path/posix, path/win32
//   - stream/web, stream/promises, stream/consumers

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- fs/promises ----
var fsPromises = require("fs/promises");
assert(fsPromises && typeof fsPromises.readFile === "function", "fs/promises.readFile");
assert(fsPromises === require("fs").promises, "fs/promises === fs.promises");
console.log("ok: require('fs/promises')");

var fsPromisesNode = require("node:fs/promises");
assert(fsPromisesNode === fsPromises, "node:fs/promises === fs/promises");
console.log("ok: require('node:fs/promises')");

// ---- path/posix and path/win32 ----
var pathPosix = require("path/posix");
var pathWin32 = require("path/win32");
assert(typeof pathPosix.join === "function", "path/posix.join is fn");
assert(typeof pathWin32.join === "function", "path/win32.join is fn");
console.log("ok: require('path/posix') / path/win32");

// ---- stream/web ----
var streamWeb = require("stream/web");
assert(typeof streamWeb.ReadableStream === "function", "stream/web.ReadableStream");
assert(typeof streamWeb.WritableStream === "function", "stream/web.WritableStream");
assert(typeof streamWeb.TransformStream === "function", "stream/web.TransformStream");
assert(streamWeb.ReadableStream === globalThis.ReadableStream, "ReadableStream === global");
console.log("ok: require('stream/web')");

// Use it: build a small ReadableStream and read from it.
var rs = new streamWeb.ReadableStream({
    start: function (controller) {
        controller.enqueue(new Uint8Array([0x68, 0x69]));  // 'hi'
        controller.close();
    }
});
var reader = rs.getReader();
reader.read().then(function (r) {
    assert(!r.done, "read got chunk");
    assert(r.value[0] === 0x68 && r.value[1] === 0x69, "chunk content 'hi'");
    return reader.read();
}).then(function (r) {
    assert(r.done, "stream done after one chunk");
    console.log("ok: stream/web ReadableStream pumping works");

    // ---- stream/promises ----
    var streamPromises = require("stream/promises");
    assert(typeof streamPromises.pipeline === "function", "stream/promises.pipeline");
    assert(typeof streamPromises.finished === "function", "stream/promises.finished");
    console.log("ok: require('stream/promises')");

    // ---- stream/consumers ----
    var consumers = require("stream/consumers");
    assert(typeof consumers.text === "function", "consumers.text");
    assert(typeof consumers.buffer === "function", "consumers.buffer");
    assert(typeof consumers.json === "function", "consumers.json");
    assert(typeof consumers.arrayBuffer === "function", "consumers.arrayBuffer");
    console.log("ok: require('stream/consumers')");

    // Drain a ReadableStream via consumers.text
    var rs2 = new streamWeb.ReadableStream({
        start: function (controller) {
            controller.enqueue(new Uint8Array([0x48, 0x69]));   // 'Hi'
            controller.enqueue(new Uint8Array([0x21]));          // '!'
            controller.close();
        }
    });
    return consumers.text(rs2);
}).then(function (txt) {
    assert(txt === "Hi!", "consumers.text drained: " + JSON.stringify(txt));
    console.log("ok: consumers.text round-trip");

    // consumers.buffer over a WHATWG ReadableStream
    var rs3 = new streamWeb.ReadableStream({
        start: function (controller) {
            controller.enqueue(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20]));  // 'hello '
            controller.enqueue(new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x64]));         // 'world'
            controller.close();
        }
    });
    return require("stream/consumers").buffer(rs3);
}).then(function (buf) {
    assert(Buffer.isBuffer(buf), "consumers.buffer returns Buffer");
    assert(buf.toString("utf8") === "hello world",
           "consumers.buffer drained: " + buf.toString("utf8"));
    console.log("ok: consumers.buffer round-trip");

    // consumers.json
    var jsonRs = new streamWeb.ReadableStream({
        start: function (controller) {
            var bytes = Buffer.from('{"key":"value","arr":[1,2,3]}', "utf8");
            controller.enqueue(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
            controller.close();
        }
    });
    return require("stream/consumers").json(jsonRs);
}).then(function (obj) {
    assert(obj.key === "value", "consumers.json parsed key");
    assert(obj.arr.length === 3 && obj.arr[2] === 3, "consumers.json parsed arr");
    console.log("ok: consumers.json round-trip");

    // consumers.arrayBuffer
    var abRs = new streamWeb.ReadableStream({
        start: function (controller) {
            controller.enqueue(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
            controller.close();
        }
    });
    return require("stream/consumers").arrayBuffer(abRs);
}).then(function (ab) {
    assert(ab instanceof ArrayBuffer, "consumers.arrayBuffer returns ArrayBuffer");
    assert(ab.byteLength === 4, "ab byteLength");
    var view = new Uint8Array(ab);
    assert(view[0] === 1 && view[3] === 4, "ab content");
    console.log("ok: consumers.arrayBuffer round-trip");

    console.log("\nsubpath_modules smoke: all assertions passed");
}).catch(function (e) {
    console.error("FAIL:", e && e.message, e && e.stack);
    process.exit(1);
});
