// chat.js — multi-client WebSocket chat server, runnable on Tiger/PPC
// via ionpower-node. Serves a single self-contained HTML page on /
// and accepts WebSocket connections on /ws. Each connected client
// gets a nickname; messages are broadcast to everyone.
//
// Run:
//     ./node examples/chat/server.js [port]
//
// Then point any modern browser at http://<host>:<port>/

var http = require("http");
var fs   = require("fs");
var path = require("path");
var os   = require("os");
var ws   = require("ws");

var PORT = parseInt(process.argv[2] || "8080", 10);
var HOST = process.env.HOST || "0.0.0.0";

// Slurp the HTML once at startup. Cheap and lets us hot-edit it
// without restarting the server during the demo if you want.
var INDEX_HTML = fs.readFileSync(path.join(__dirname, "index.html"));

// Server-info banner (shown to clients on first connect so the
// "wait, that's running on a G3?" moment lands).
var BANNER = {
    type:    "system",
    runtime: process.version,    // already 'ionpower-node-X.Y'
    arch:    process.arch + " (" + os.platform() + ")",
    cpus:    (os.cpus()[0] || { model: "unknown" }).model,
    host:    os.hostname(),
    started: new Date().toISOString()
};

// ---- HTTP: serve the page on /, return WebSocket info on /info ----
var server = http.createServer(function (req, res) {
    if (req.url === "/info") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(BANNER));
        return;
    }
    if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, {
            "Content-Type":   "text/html; charset=utf-8",
            "Content-Length": INDEX_HTML.length
        });
        res.end(INDEX_HTML);
        return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found\n");
});

server.listen(PORT, HOST, function () {
    var addr = server.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || PORT);
    console.log("=== ionpower-node chat ===");
    console.log("  runtime: " + BANNER.runtime);
    console.log("  arch:    " + BANNER.arch);
    console.log("  cpu:     " + BANNER.cpus);
    console.log("  host:    " + BANNER.host);
    console.log("");
    console.log("  http://" + bind + "/");
});

// ---- WebSocket: bolted on as a separate listener on the same port ----
// (Our ws module's WebSocketServer wants its own port today; we run
// a parallel ws server on PORT+1 for now and have the page connect
// there. Future: a `noServer:true` mode that hooks `upgrade`.)
var WS_PORT = PORT + 1;
var wss = new ws.WebSocketServer({ port: WS_PORT, host: HOST });

var nextNickId = 1;
var clients = [];   // [{ socket, nick, joinedAt }]
function nextNick() { return "guest" + (nextNickId++); }

function broadcast(payload) {
    var msg = JSON.stringify(payload);
    for (var i = 0; i < clients.length; i++) {
        try { clients[i].socket.send(msg); } catch (e) {}
    }
}

function tsHM() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

wss.on("listening", function () {
    var addr = wss.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || WS_PORT);
    console.log("  ws://" + bind + "/  (the chat firehose)");
    console.log("");
});

wss.on("connection", function (sock) {
    var entry = { socket: sock, nick: nextNick(), joinedAt: Date.now() };
    clients.push(entry);

    // Send the new client a banner + roster + welcome.
    sock.send(JSON.stringify({ type: "banner",  data: BANNER }));
    sock.send(JSON.stringify({ type: "you",     nick: entry.nick }));
    sock.send(JSON.stringify({
        type: "roster",
        nicks: clients.map(function (c) { return c.nick; })
    }));

    broadcast({
        type: "join",
        nick: entry.nick,
        roster: clients.map(function (c) { return c.nick; })
    });

    console.log("[" + tsHM() + "] " + entry.nick + " joined  (" + clients.length + " online)");

    sock.on("message", function (raw, isBinary) {
        if (isBinary) return;  // ignore binary frames in chat
        var data = String(raw);
        var msg;
        try { msg = JSON.parse(data); } catch (e) { return; }

        if (msg.type === "nick" && typeof msg.nick === "string") {
            var newNick = msg.nick.trim().slice(0, 24).replace(/[\x00-\x1f<>]/g, "");
            if (!newNick) return;
            var oldNick = entry.nick;
            entry.nick = newNick;
            broadcast({
                type:   "nick",
                oldNick: oldNick,
                newNick: newNick,
                roster:  clients.map(function (c) { return c.nick; })
            });
            console.log("[" + tsHM() + "] " + oldNick + " -> " + newNick);
            return;
        }

        if (msg.type === "msg" && typeof msg.text === "string") {
            var text = msg.text.slice(0, 1024);
            broadcast({
                type: "msg",
                nick: entry.nick,
                text: text,
                ts:   Date.now()
            });
            console.log("[" + tsHM() + "] <" + entry.nick + "> " + text);
            return;
        }
    });

    sock.on("close", function () {
        var i = clients.indexOf(entry);
        if (i >= 0) clients.splice(i, 1);
        broadcast({
            type:   "leave",
            nick:   entry.nick,
            roster: clients.map(function (c) { return c.nick; })
        });
        console.log("[" + tsHM() + "] " + entry.nick + " left   (" + clients.length + " online)");
    });

    sock.on("error", function (err) {
        console.error("[" + tsHM() + "] " + entry.nick + " error: " + (err && err.message || err));
    });
});

// Heartbeat: every 30 s, log roster size to the server console so
// you can visually confirm liveness during a demo.
setInterval(function () {
    console.log("[" + tsHM() + "] (heartbeat) " + clients.length + " online");
}, 30000);

process.on("SIGINT", function () {
    console.log("\n  shutting down...");
    try { wss.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(0);
});
