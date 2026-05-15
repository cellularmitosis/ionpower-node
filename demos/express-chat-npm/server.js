// express-chat-npm/server.js
//
// The same anonymous chat board as demos/express-chat/, except this
// version pulls Express + handlebars + ws from npm — i.e. it runs after
// `npm install` against the live registry, NOT against our vendored
// test/vendor/ tree. The first time you start it, it'll spend a few
// minutes installing the dep closure (~70 packages, ~25 MB); after
// that it boots in a few seconds like the vanilla demo.
//
// Distinct from demos/express-chat/:
//   - require('express') / require('handlebars') / require('ws')
//     instead of require(path.join(VENDOR_DIR, 'express')) etc.
//   - Ships a package.json so `npm install` resolves the closure.
//   - Demonstrates the full npm-fetch + tinflate + require + V8
//     CallSite stack the runtime exposes (v0.97+).

var path   = require("path");
var fs     = require("fs");
var crypto = require("crypto");
var os     = require("os");
var http   = require("http");
var ws     = require("ws");

// All three come from node_modules — installed by `npm install` from
// this demo's package.json. No vendor-tree fallback.
var express    = require("express");
var handlebars = require("handlebars");

var PORT    = parseInt(process.argv[2] || "8080", 10);
var WS_PORT = PORT + 1;
var HOST    = process.env.HOST || "0.0.0.0";

var DEMO_DIR   = __dirname;
var VIEWS_DIR  = path.join(DEMO_DIR, "views");
var STATIC_DIR = path.join(DEMO_DIR, "static");

// ---- Server banner ----
var STARTED = new Date().toISOString();
var BANNER = {
    runtime:     process.version,
    ionpower:    process.versions["ionpower-node"],
    arch:        process.arch + " (" + os.platform() + ")",
    cpu:         (os.cpus()[0] || { model: "?" }).model,
    host:        os.hostname(),
    started:     STARTED,
    express:     require("express/package.json").version,
    handlebars:  require("handlebars/package.json").version,
    ws:          require("ws/package.json").version
};

// ---- In-memory post store ----
var posts    = [];    // [{no,name,trip?,text,ts}]
var nextNo   = 1;
var MAX_POSTS = 200;

// ---- Rate limiter: one post per 2s per IP ----
var lastPostMs = {};  // Map<ip, ts>

// ---- Tripcode: base64(sha256(secret))[:10] ----
function computeTrip(secret) {
    return crypto
        .createHash("sha256")
        .update(String(secret), "utf8")
        .digest("base64")
        .slice(0, 10);
}

// ---- Express app ----
var app = express();
app.use(express.json());

app.use(function (req, res, next) {
    res.render = function (name, ctx) {
        var src  = fs.readFileSync(path.join(VIEWS_DIR, name + ".hbs"), "utf8");
        var html = handlebars.compile(src)(ctx || {});
        res.set("Content-Type", "text/html; charset=utf-8").send(html);
    };
    next();
});

app.use("/static", function (req, res, next) {
    var rel = req.path.replace(/\.\./g, "");
    var fp  = path.join(STATIC_DIR, rel);
    fs.readFile(fp, function (err, data) {
        if (err) { return next(); }
        var ext  = path.extname(fp).toLowerCase();
        var mime = { ".css": "text/css", ".js": "application/javascript" }[ext]
                   || "application/octet-stream";
        res.set("Content-Type", mime).send(data);
    });
});

app.get("/", function (req, res) {
    res.render("index", {
        banner:  JSON.stringify(BANNER),
        wsport:  WS_PORT,
        online:  wsClients.length,
        posts:   posts.slice(-50)
    });
});

app.get("/info", function (req, res) {
    res.json(Object.assign({}, BANNER, { online: wsClients.length }));
});

app.post("/api/post", function (req, res) {
    var body = req.body || {};

    var text = String(body.text || "").slice(0, 1024);
    if (!text.trim()) {
        return res.status(400).json({ error: "empty text" });
    }

    var ip = req.ip || (req.connection && req.connection.remoteAddress) || "?";
    var now = Date.now();
    if (lastPostMs[ip] && now - lastPostMs[ip] < 2000) {
        return res.status(429).json({ error: "Too Many Requests" });
    }
    lastPostMs[ip] = now;

    var name = String(body.name || "Anonymous").slice(0, 24) || "Anonymous";

    var trip;
    if (body.tripcode && String(body.tripcode).length > 0) {
        trip = computeTrip(body.tripcode);
    }

    var post = { no: nextNo++, name: name, text: text, ts: now };
    if (trip !== undefined) post.trip = trip;

    posts.push(post);
    if (posts.length > MAX_POSTS) posts.shift();

    broadcast({ type: "post", post: post });

    console.log("[" + new Date().toISOString() + "] POST /api/post no=" + post.no +
                " name=" + name + (trip ? " trip=" + trip : "") +
                " len=" + text.length);

    res.json(post);
});

app.get("/api/posts", function (req, res) {
    var since = parseInt(req.query.since, 10);
    var result = isNaN(since)
        ? posts.slice(-200)
        : posts.filter(function (p) { return p.no > since; });
    res.json(result);
});

var server = http.createServer(app);

server.listen(PORT, HOST, function () {
    var addr = server.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || PORT);
    console.log("=== ionpower-node express-chat-npm ===");
    console.log("  runtime:    " + BANNER.runtime + " (ionpower " + BANNER.ionpower + ")");
    console.log("  arch:       " + BANNER.arch);
    console.log("  cpu:        " + BANNER.cpu);
    console.log("  host:       " + BANNER.host);
    console.log("  express:    " + BANNER.express);
    console.log("  handlebars: " + BANNER.handlebars);
    console.log("  ws:         " + BANNER.ws);
    console.log("");
    console.log("  http://" + bind + "/");
});

var wss = new ws.WebSocketServer({ port: WS_PORT, host: HOST });
var wsClients = [];

function broadcast(payload) {
    var msg = JSON.stringify(payload);
    for (var i = 0; i < wsClients.length; i++) {
        try { wsClients[i].send(msg); } catch (e) {}
    }
}

wss.on("listening", function () {
    var addr = wss.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || WS_PORT);
    console.log("  ws://" + bind + "/  (real-time push)");
    console.log("");
});

wss.on("connection", function (sock) {
    wsClients.push(sock);

    try {
        sock.send(JSON.stringify({
            type:  "history",
            posts: posts.slice(-50)
        }));
    } catch (e) {}

    sock.on("close", function () {
        var i = wsClients.indexOf(sock);
        if (i >= 0) wsClients.splice(i, 1);
    });

    sock.on("error", function (err) {
        var i = wsClients.indexOf(sock);
        if (i >= 0) wsClients.splice(i, 1);
    });
});

wss.on("error", function (err) {
    console.error("WS error:", err && err.message);
});

process.on("SIGINT", function () {
    console.log("\nshutting down...");
    try { wss.close(); }    catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(0);
});
