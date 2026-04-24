// WebSocket (RFC 6455) client + server round-trip.
//
// Starts an in-process WebSocketServer on an ephemeral port, connects
// a client, exchanges text + binary frames, and closes cleanly.

var ws = require("ws");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var textGotServer  = false;
var binaryGotServer = false;
var textGotClient  = false;
var binaryGotClient = false;
var clientClosed = false;
var done = false;

function finish(err) {
    if (done) return;
    done = true;
    try { server.close(); } catch (e) {}
    if (err) { console.error("FAIL:", err.message || err); process.exit(1); }
    assert(textGotServer,   "server received text");
    assert(binaryGotServer, "server received binary");
    assert(textGotClient,   "client received text reply");
    assert(binaryGotClient, "client received binary reply");
    assert(clientClosed,    "client close event fired");
    console.log("ok: WebSocket round-trip (text + binary) + close");
    console.log("\nwebsocket smoke: all assertions passed");
}

var watchdog = setTimeout(function () {
    finish(new Error("WebSocket smoke timed out"));
}, 5000);

var server = new ws.WebSocketServer({ port: 0, host: "127.0.0.1" });

server.on("listening", function () {
    var addr = server.address();
    assert(addr.port > 0, "server bound to port");
    var url = "ws://127.0.0.1:" + addr.port + "/";

    server.on("connection", function (sws) {
        sws.on("message", function (data, isBinary) {
            if (isBinary) {
                binaryGotServer = true;
                sws.send(Buffer.from([42, 43, 44]));  // reply binary
            } else {
                textGotServer = true;
                assert(data === "hello server", "server text payload");
                sws.send("hello client");
            }
        });
    });

    var client = new WebSocket(url);
    client.onopen = function () {
        client.send("hello server");
        client.send(Buffer.from([1, 2, 3]));
    };
    client.onmessage = function (ev) {
        if (typeof ev.data === "string") {
            assert(ev.data === "hello client", "client text reply");
            textGotClient = true;
        } else {
            assert(ev.data.length === 3 && ev.data[0] === 42, "client binary reply");
            binaryGotClient = true;
        }
        if (textGotClient && binaryGotClient) {
            client.close(1000, "done");
        }
    };
    client.onclose = function (ev) {
        clientClosed = true;
        clearTimeout(watchdog);
        setImmediate(finish);
    };
    client.onerror = function (err) {
        finish(new Error("client error: " + (err && err.message || err)));
    };
});
