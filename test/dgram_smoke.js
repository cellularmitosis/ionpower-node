// dgram (UDP) loopback smoke.
//
// Creates two UDP sockets. Server binds to an ephemeral port, then the
// client sends a message. Server's 'message' handler echoes a reply;
// client's 'message' handler ends the test.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var dgram = require("dgram");
assert(typeof dgram.createSocket === "function", "dgram.createSocket exists");
assert(typeof dgram.Socket === "function", "dgram.Socket exists");

var server = dgram.createSocket("udp4");
var client = dgram.createSocket("udp4");

var clientGot = false;
var serverGot = false;
var done = false;

function finish(err) {
    if (done) return;
    done = true;
    try { client.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
    if (err) { console.error("FAIL:", err.message || err); process.exit(1); }
    console.log("ok: dgram round-trip");
    console.log("\ndgram smoke: all assertions passed");
}

var watchdog = setTimeout(function () {
    finish(new Error("dgram smoke timed out after 5s"));
}, 5000);

server.on("error", function (err) {
    finish(new Error("server error: " + err.message));
});

server.on("message", function (msg, rinfo) {
    serverGot = true;
    assert(Buffer.isBuffer(msg), "server got Buffer");
    assert(msg.toString() === "ping", "server got 'ping'");
    assert(typeof rinfo.address === "string", "rinfo.address is string");
    assert(typeof rinfo.port === "number", "rinfo.port is number");
    assert(rinfo.family === "IPv4", "rinfo.family");
    // Reply back
    server.send("pong", rinfo.port, rinfo.address);
});

server.on("listening", function () {
    var addr = server.address();
    assert(addr.port > 0, "server bound to ephemeral port");

    client.on("error", function (err) {
        finish(new Error("client error: " + err.message));
    });
    client.on("message", function (msg, rinfo) {
        clientGot = true;
        assert(msg.toString() === "pong", "client got 'pong'");
        clearTimeout(watchdog);
        finish();
    });

    client.send("ping", addr.port, "127.0.0.1");
});

server.bind(0, "127.0.0.1");
