// chat.js — multi-client chat server, runnable on Tiger/PPC via
// ionpower-node. Serves a single self-contained HTML page on /, accepts
// WebSocket connections on PORT+1 for modern browsers, AND offers HTTP
// short-poll endpoints (GET /poll, POST /post) so the same demo works
// on Safari 4 / Tiger PPC clients (no WebSocket, no fetch, no Promise).
//
// Run:
//     ./node demos/chat/server.js [port]
//
// Then point any browser — modern or Tiger Safari 4 — at
// http://<host>:<port>/

var http = require("http");
var fs   = require("fs");
var path = require("path");
var os   = require("os");
var url  = require("url");
var ws   = require("ws");

var PORT = parseInt(process.argv[2] || "8080", 10);
var HOST = process.env.HOST || "0.0.0.0";

var INDEX_HTML = fs.readFileSync(path.join(__dirname, "index.html"));

var BANNER = {
    type:    "system",
    runtime: process.version,
    arch:    process.arch + " (" + os.platform() + ")",
    cpus:    (os.cpus()[0] || { model: "unknown" }).model,
    host:    os.hostname(),
    started: new Date().toISOString()
};

// ---- Unified message log (shared between WS clients and HTTP pollers) ----
//
// Each entry: { no, kind: "msg"|"sys", nick?, text, ts }
// Polling clients GET messages with no > since; WS clients receive
// the same payloads in real-time. The buffer keeps the last MAX_MSG
// entries so a long-disconnected poller still gets reasonable history.
var msgLog = [];
var nextNo = 1;
var MAX_MSG = 500;

function pushMsg(entry) {
    entry.no = nextNo++;
    msgLog.push(entry);
    if (msgLog.length > MAX_MSG) msgLog.splice(0, msgLog.length - MAX_MSG);
    return entry;
}

// ---- HTTP-poll client tracking (so they show up in the roster) ----
var httpClients = {}; // nick -> { lastSeen }
var HTTP_TTL = 20000; // 20 s without a poll = considered gone

function reapHttp(now) {
    for (var nick in httpClients) {
        if (now - httpClients[nick].lastSeen > HTTP_TTL) {
            delete httpClients[nick];
            // Synthesize a "leave" sys message so WS clients see them go.
            pushMsg({ kind: "sys", text: nick + " left" });
            broadcastWS({ type: "leave", nick: nick, roster: rosterAll() });
        }
    }
}

function rosterAll() {
    var nicks = clients.map(function (c) { return c.nick; });
    for (var nick in httpClients) nicks.push(nick);
    return nicks;
}

// ---- HTTP routing ----
function readBody(req, cb) {
    var chunks = [], total = 0;
    req.on("data", function (c) {
        chunks.push(c);
        total += c.length;
        // Cap body size to avoid runaway clients.
        if (total > 8192) { req.destroy(); cb("too-large"); }
    });
    req.on("end", function () {
        if (typeof Buffer !== "undefined" && Buffer.concat) {
            cb(null, Buffer.concat(chunks).toString("utf8"));
        } else {
            cb(null, chunks.join(""));
        }
    });
    req.on("error", function (e) { cb(e); });
}

function parseFormBody(s) {
    var out = {};
    if (!s) return out;
    var parts = s.split("&");
    for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split("=");
        var k = decodeURIComponent((kv[0] || "").replace(/\+/g, " "));
        var v = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
        if (k) out[k] = v;
    }
    return out;
}

function sanitizeNick(s) {
    if (typeof s !== "string") return "";
    return s.replace(/^\s+|\s+$/g, "")
            .substring(0, 24)
            .replace(/[\x00-\x1f<>]/g, "");
}

var nextNickId = 1;
function nextHttpNick() {
    // Skip nicks already in use by either WS or HTTP clients.
    while (true) {
        var n = "guest" + (nextNickId++);
        if (!hasNick(n)) return n;
    }
}
function hasNick(n) {
    for (var i = 0; i < clients.length; i++) if (clients[i].nick === n) return true;
    if (httpClients[n]) return true;
    return false;
}

var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);

    if (u.pathname === "/info") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(BANNER));
        return;
    }

    if (u.pathname === "/" || u.pathname === "/index.html") {
        res.writeHead(200, {
            "Content-Type":   "text/html; charset=utf-8",
            "Content-Length": INDEX_HTML.length
        });
        res.end(INDEX_HTML);
        return;
    }

    // -------- Polling endpoint --------
    if (u.pathname === "/poll" && req.method === "GET") {
        var since = parseInt(u.query.since || "0", 10) || 0;
        var nick  = sanitizeNick(u.query.nick);
        var now   = +new Date();
        reapHttp(now);

        // Brand-new client without a nick: assign one.
        var assigned = false;
        if (!nick || !httpClients[nick]) {
            // Either no nick was sent, or we expired theirs while they
            // were idle. Mint a fresh one and let them reset state.
            if (!nick) {
                nick = nextHttpNick();
                assigned = true;
            } else {
                // They sent a nick we don't know — re-claim it (roster
                // membership lapsed). If someone else has it, mint new.
                if (hasNick(nick)) {
                    nick = nextHttpNick();
                    assigned = true;
                }
            }
        }
        httpClients[nick] = { lastSeen: now };

        if (assigned) {
            // Tell other clients about the new arrival.
            pushMsg({ kind: "sys", text: nick + " joined" });
            broadcastWS({ type: "join", nick: nick, roster: rosterAll() });
        }

        // Build response.
        var out = [];
        for (var i = 0; i < msgLog.length; i++) {
            if (msgLog[i].no > since) out.push(msgLog[i]);
        }
        var body = {
            messages:  out,
            roster:    rosterAll(),
            you:       nick,
            nextSince: msgLog.length > 0 ? msgLog[msgLog.length - 1].no : since,
            banner:    BANNER
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
        return;
    }

    // -------- Post / nick-change endpoint --------
    if (u.pathname === "/post" && req.method === "POST") {
        readBody(req, function (err, raw) {
            if (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: String(err) }));
                return;
            }
            var f = parseFormBody(raw);
            var oldNick = sanitizeNick(f.nick);
            var now = +new Date();

            // /nick rename path
            if (typeof f.newNick === "string") {
                var newNick = sanitizeNick(f.newNick);
                if (!newNick || hasNick(newNick)) {
                    res.writeHead(409, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "nick taken or empty" }));
                    return;
                }
                if (oldNick && httpClients[oldNick]) {
                    delete httpClients[oldNick];
                    httpClients[newNick] = { lastSeen: now };
                    pushMsg({ kind: "sys", text: oldNick + " is now " + newNick });
                    broadcastWS({ type: "nick", oldNick: oldNick, newNick: newNick, roster: rosterAll() });
                    console.log("[" + tsHM() + "] " + oldNick + " -> " + newNick);
                } else {
                    httpClients[newNick] = { lastSeen: now };
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, youNick: newNick }));
                return;
            }

            // Plain message path
            var text = (f.text || "").substring(0, 1024);
            if (!text || !oldNick || !httpClients[oldNick]) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: "no text or no nick" }));
                return;
            }
            httpClients[oldNick].lastSeen = now;
            var msg = pushMsg({ kind: "msg", nick: oldNick, text: text, ts: now });
            broadcastWS({ type: "msg", nick: oldNick, text: text, ts: now });
            console.log("[" + tsHM() + "] <" + oldNick + "> " + text);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, no: msg.no }));
        });
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
    console.log("  http://" + bind + "/  (modern + Tiger Safari 4)");
});

// ---- WebSocket: separate listener on PORT+1 for modern clients ----
var WS_PORT = PORT + 1;
var wss = new ws.WebSocketServer({ port: WS_PORT, host: HOST });

var clients = [];

function broadcastWS(payload) {
    var s = JSON.stringify(payload);
    for (var i = 0; i < clients.length; i++) {
        try { clients[i].socket.send(s); } catch (e) {}
    }
}

function tsHM() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

function nextWSNick() {
    while (true) {
        var n = "guest" + (nextNickId++);
        if (!hasNick(n)) return n;
    }
}

wss.on("listening", function () {
    var addr = wss.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || WS_PORT);
    console.log("  ws://" + bind + "/  (real-time push for modern clients)");
    console.log("");
});

wss.on("connection", function (sock) {
    var entry = { socket: sock, nick: nextWSNick(), joinedAt: +new Date() };
    clients.push(entry);

    sock.send(JSON.stringify({ type: "banner", data: BANNER }));
    sock.send(JSON.stringify({ type: "you",    nick: entry.nick }));
    sock.send(JSON.stringify({ type: "roster", nicks: rosterAll() }));

    pushMsg({ kind: "sys", text: entry.nick + " joined" });
    broadcastWS({ type: "join", nick: entry.nick, roster: rosterAll() });

    console.log("[" + tsHM() + "] " + entry.nick + " joined  (" + clients.length + " online)");

    sock.on("message", function (raw, isBinary) {
        if (isBinary) return;
        var data = String(raw);
        var msg;
        try { msg = JSON.parse(data); } catch (e) { return; }

        if (msg.type === "nick" && typeof msg.nick === "string") {
            var newNick = sanitizeNick(msg.nick);
            if (!newNick || hasNick(newNick)) return;
            var oldNick = entry.nick;
            entry.nick = newNick;
            pushMsg({ kind: "sys", text: oldNick + " is now " + newNick });
            broadcastWS({
                type:    "nick",
                oldNick: oldNick,
                newNick: newNick,
                roster:  rosterAll()
            });
            console.log("[" + tsHM() + "] " + oldNick + " -> " + newNick);
            return;
        }

        if (msg.type === "msg" && typeof msg.text === "string") {
            var text = msg.text.substring(0, 1024);
            var ts   = +new Date();
            pushMsg({ kind: "msg", nick: entry.nick, text: text, ts: ts });
            broadcastWS({ type: "msg", nick: entry.nick, text: text, ts: ts });
            console.log("[" + tsHM() + "] <" + entry.nick + "> " + text);
            return;
        }
    });

    sock.on("close", function () {
        var i = clients.indexOf(entry);
        if (i >= 0) clients.splice(i, 1);
        pushMsg({ kind: "sys", text: entry.nick + " left" });
        broadcastWS({ type: "leave", nick: entry.nick, roster: rosterAll() });
        console.log("[" + tsHM() + "] " + entry.nick + " left   (" + clients.length + " online)");
    });

    sock.on("error", function (err) {
        console.error("[" + tsHM() + "] " + entry.nick + " error: " + (err && err.message || err));
    });
});

// Heartbeat: every 30 s, log roster size + reap stale HTTP clients.
setInterval(function () {
    reapHttp(+new Date());
    var nWS = clients.length;
    var nHTTP = 0;
    for (var k in httpClients) nHTTP++;
    console.log("[" + tsHM() + "] (heartbeat) " + nWS + " ws + " + nHTTP + " http online");
}, 30000);

process.on("SIGINT", function () {
    console.log("\n  shutting down...");
    try { wss.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(0);
});
