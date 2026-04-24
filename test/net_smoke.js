// net.Socket + net.createServer — single-process client/server handshake.

var net = require("net");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// 1. Server on 127.0.0.1:0 (pick port), client connects, echoes payload, closes.
var serverConns = 0, bytesEchoed = 0;
var server = net.createServer(function (sock) {
    serverConns++;
    sock.on("data", function (buf) {
        bytesEchoed += buf.length;
        sock.write(buf);
    });
    sock.on("end", function () { sock.end(); });
    sock.on("error", function (e) { console.error("server sock error:", e); });
});

var gotConnect = false;
var clientChunks = [];
var clientClosed = false;

server.listen(0, "127.0.0.1", function () {
    var addr = server.address();
    assert(typeof addr.port === "number" && addr.port > 0, "server.address().port");
    console.log("ok: server listening on " + addr.host + ":" + addr.port);

    var client = net.connect(addr.port, "127.0.0.1", function () {
        gotConnect = true;
        client.write("hello ");
        client.write("world");
        client.end();
    });
    client.on("data", function (c) { clientChunks.push(c); });
    client.on("close", function () { clientClosed = true; server.close(); });
    client.on("error", function (e) { console.error("client error:", e); process.exit(1); });
});

process.on("exit", function () {
    assert(gotConnect, "client fired 'connect'");
    var received = Buffer.concat(clientChunks).toString("utf8");
    if (received !== "hello world") {
        console.error("FAIL: echoed payload: got " + JSON.stringify(received));
        process.exit(1);
    }
    assert(clientClosed, "client 'close' fired");
    assert(serverConns === 1, "server got 1 connection");
    assert(bytesEchoed === 11, "server echoed 11 bytes");
    console.log("ok: tcp echo (" + bytesEchoed + " bytes)");
    console.log("\nnet smoke: all assertions passed");
});
