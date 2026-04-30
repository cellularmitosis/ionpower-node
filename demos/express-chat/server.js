// express-chat/server.js
//
// Anonymous chat board running on real Express 4 via the ionpower-node
// runtime on a 1999 iBook G3 (Tiger 10.4.11, PPC 750 900 MHz).
//
// Routes:
//   GET  /             -> rendered index.hbs (initial feed)
//   GET  /info         -> JSON server banner
//   POST /api/post     -> { text, name?, tripcode? } -> new post JSON
//   GET  /api/posts    -> last 200 posts JSON
//   GET  /api/posts?since=N -> posts with no > N
//   GET  /static/*     -> static assets
//
// WebSocket on PORT+1:
//   -> connect: { type:"history", posts:[...last 50...] }
//   -> on post: { type:"post", post:{...} }
//
// Run:
//   ./node demos/express-chat/server.js [port]

var path   = require("path");
var fs     = require("fs");
var crypto = require("crypto");
var os     = require("os");
var http   = require("http");
var ws     = require("ws");

// Load Express from our vendor tree.
// Use path.join(__dirname,...) so this works regardless of cwd.
var VENDOR_DIR = path.join(__dirname, "../../test/vendor");
var express    = require(path.join(VENDOR_DIR, "express"));

// Load handlebars for template rendering (already vendored)
var handlebars = require(path.join(VENDOR_DIR, "handlebars.js"));

var PORT    = parseInt(process.argv[2] || "8080", 10);
var WS_PORT = PORT + 1;
var HOST    = process.env.HOST || "0.0.0.0";

var DEMO_DIR   = __dirname;
var VIEWS_DIR  = path.join(DEMO_DIR, "views");
var STATIC_DIR = path.join(DEMO_DIR, "static");

// ---- Server banner ----
var STARTED = new Date().toISOString();
var BANNER = {
    runtime: process.version,
    arch:    process.arch + " (" + os.platform() + ")",
    cpu:     (os.cpus()[0] || { model: "?" }).model,
    host:    os.hostname(),
    started: STARTED
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

// Parse JSON bodies (Express 4 built-in / body-parser)
app.use(express.json());

// Custom render middleware (no express-handlebars dep needed)
app.use(function (req, res, next) {
    res.render = function (name, ctx) {
        var src  = fs.readFileSync(path.join(VIEWS_DIR, name + ".hbs"), "utf8");
        var html = handlebars.compile(src)(ctx || {});
        res.set("Content-Type", "text/html; charset=utf-8").send(html);
    };
    next();
});

// ---- Static files (/static/*) ----
app.use("/static", function (req, res, next) {
    // Strip query string and decode
    var rel = req.path.replace(/\.\./g, "");  // no traversal
    var fp  = path.join(STATIC_DIR, rel);
    fs.readFile(fp, function (err, data) {
        if (err) { return next(); }
        var ext  = path.extname(fp).toLowerCase();
        var mime = { ".css": "text/css", ".js": "application/javascript" }[ext]
                   || "application/octet-stream";
        res.set("Content-Type", mime).send(data);
    });
});

// ---- GET / — render the chat board ----
app.get("/", function (req, res) {
    var online = wsClients.length;
    res.render("index", {
        banner:  JSON.stringify(BANNER),
        wsport:  WS_PORT,
        online:  online,
        posts:   posts.slice(-50)     // last 50 for initial render
    });
});

// ---- GET /info ----
app.get("/info", function (req, res) {
    res.json(Object.assign({}, BANNER, { online: wsClients.length }));
});

// ---- POST /api/post ----
app.post("/api/post", function (req, res) {
    var body = req.body || {};

    // Validate text
    var text = String(body.text || "").slice(0, 1024);
    if (!text.trim()) {
        return res.status(400).json({ error: "empty text" });
    }

    // Rate limit per IP
    var ip = req.ip || (req.connection && req.connection.remoteAddress) || "?";
    var now = Date.now();
    if (lastPostMs[ip] && now - lastPostMs[ip] < 2000) {
        return res.status(429).json({ error: "Too Many Requests" });
    }
    lastPostMs[ip] = now;

    // Name
    var name = String(body.name || "Anonymous").slice(0, 24) || "Anonymous";

    // Tripcode (optional; raw secret is discarded after hashing)
    var trip;
    if (body.tripcode && String(body.tripcode).length > 0) {
        trip = computeTrip(body.tripcode);
    }

    // Build post
    var post = { no: nextNo++, name: name, text: text, ts: now };
    if (trip !== undefined) post.trip = trip;

    // Ring buffer
    posts.push(post);
    if (posts.length > MAX_POSTS) posts.shift();

    // Broadcast to WS subscribers
    broadcast({ type: "post", post: post });

    console.log("[" + new Date().toISOString() + "] POST /api/post no=" + post.no +
                " name=" + name + (trip ? " trip=" + trip : "") +
                " len=" + text.length);

    res.json(post);
});

// ---- GET /api/posts[?since=N] ----
app.get("/api/posts", function (req, res) {
    var since = parseInt(req.query.since, 10);
    var result = isNaN(since)
        ? posts.slice(-200)
        : posts.filter(function (p) { return p.no > since; });
    res.json(result);
});

// ---- HTTP server + WS on PORT+1 ----
var server = http.createServer(app);

server.listen(PORT, HOST, function () {
    var addr = server.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || PORT);
    console.log("=== ionpower-node express-chat ===");
    console.log("  runtime: " + BANNER.runtime);
    console.log("  arch:    " + BANNER.arch);
    console.log("  cpu:     " + BANNER.cpu);
    console.log("  host:    " + BANNER.host);
    console.log("");
    console.log("  http://" + bind + "/");
    console.log("");
    console.log("  POST /api/post  { text, name?, tripcode? }");
    console.log("  GET  /api/posts[?since=N]");
});

// WebSocket server on PORT+1
// (Same-port upgrade not yet implemented in ionpower-node ws module;
//  matches the pattern used by demos/chat/. WS_PORT is defined near
//  the top so it's available in route handlers.)
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

    // Send history on connect (last 50 posts)
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
    try { wss.close(); }   catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(0);
});
