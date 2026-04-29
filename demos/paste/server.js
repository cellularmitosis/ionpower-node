// paste server -- a single web app that exercises the v0.65-v0.81
// crypto + zlib + http stack end-to-end:
//
//   POST /paste   { text } in JSON
//     -> generates 96-bit nonce
//     -> AES-256-GCM encrypts the text with a per-server master key
//     -> zlib.gzipSync compresses the ciphertext + auth tag
//     -> writes to ./paste-store/<id>.bin
//     -> issues an ES256 JWT bearer carrying { id, exp }
//     -> returns { url: '/paste/<id>', token: '<jwt>' }
//
//   GET /paste/<id>   Authorization: Bearer <jwt>
//     -> verifies JWT against server pubkey (ES256, ECDSA P-256)
//     -> reads + gunzips + AES-GCM decrypts
//     -> returns the plaintext
//
//   GET /        the inline HTML form for trying it from a browser
//   GET /info    server runtime banner JSON
//
// Run:
//   ./node demos/paste/server.js [port]
//
// On startup the server (re)generates an ECDSA P-256 keypair (the
// JWT signing key) and a 32-byte AES key (the paste encryption key),
// both ephemeral — restart = all old tokens invalid + all old pastes
// undecryptable. That's intentional for the demo: keys never touch
// disk, no key-management story to design.

var http   = require("http");
var fs     = require("fs");
var path   = require("path");
var crypto = require("crypto");
var os     = require("os");
var zlib   = require("zlib");

var PORT = parseInt(process.argv[2] || "8090", 10);
var HOST = process.env.HOST || "0.0.0.0";

// ---- Storage dir ----
var STORE_DIR = path.join(__dirname, "paste-store");
fs.mkdirSync(STORE_DIR, { recursive: true });

// ---- Per-startup secrets ----
console.log("Generating ephemeral ECDSA P-256 signing key (slow on G3)...");
var t0 = Date.now();
var kp = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
console.log("  keygen took " + (Date.now() - t0) + " ms");

var AES_KEY = crypto.randomBytes(32);
console.log("  AES-256-GCM master key: 32 random bytes");

// ---- HTML page (inline so the demo is one file + one server.js) ----
var INDEX_HTML;
var INDEX_PATH = path.join(__dirname, "index.html");
try { INDEX_HTML = fs.readFileSync(INDEX_PATH); }
catch (e) { INDEX_HTML = Buffer.from("<h1>paste server up; index.html missing</h1>"); }

// ---- Banner ----
var BANNER = {
    runtime: process.version,
    arch:    process.arch + " (" + os.platform() + ")",
    cpu:     (os.cpus()[0] || { model: "?" }).model,
    host:    os.hostname(),
    started: new Date().toISOString()
};

// ---- JWT helpers (no external lib) ----
function b64url(buf) {
    if (typeof buf === "string") buf = Buffer.from(buf, "utf8");
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64");
}
function issueToken(payload) {
    var header = { alg: "ES256", typ: "JWT" };
    var data = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
    var sig = crypto.sign("sha256", Buffer.from(data, "utf8"), kp.privateKey);
    return data + "." + b64url(sig);
}
function verifyToken(token) {
    var parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    var data = parts[0] + "." + parts[1];
    var sig  = b64urlDecode(parts[2]);
    if (!crypto.verify("sha256", Buffer.from(data, "utf8"), kp.publicKey, sig)) return null;
    try {
        var payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
        if (payload.exp && Date.now() / 1000 > payload.exp) return null;
        return payload;
    } catch (e) { return null; }
}

// ---- Encrypt / decrypt + compress / decompress ----
function encryptAndStore(plaintext) {
    var iv = crypto.randomBytes(12);
    var cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
    var ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    var tag = cipher.getAuthTag();
    // Layout on disk: [12 IV][16 TAG][ciphertext]  -- gzipped together.
    var payload = Buffer.concat([iv, tag, ct]);
    var compressed = zlib.gzipSync(payload);
    var id = crypto.randomBytes(8).toString("hex");
    fs.writeFileSync(path.join(STORE_DIR, id + ".bin"), compressed);
    return { id: id,
             stored: compressed.length,
             ratio:  Math.round((1 - compressed.length / payload.length) * 100) };
}

function readAndDecrypt(id) {
    if (!/^[0-9a-f]{16}$/.test(id)) return null;
    var p = path.join(STORE_DIR, id + ".bin");
    if (!fs.existsSync(p)) return null;
    var compressed = fs.readFileSync(p);
    var payload = zlib.gunzipSync(compressed);
    var iv  = payload.slice(0, 12);
    var tag = payload.slice(12, 28);
    var ct  = payload.slice(28);
    var dec = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
    dec.setAuthTag(tag);
    var pt = Buffer.concat([dec.update(ct), dec.final()]);
    return pt.toString("utf8");
}

// ---- HTTP server ----
function readBodyJson(req) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        req.on("data", function (c) { chunks.push(c); });
        req.on("end",  function () {
            try {
                var s = Buffer.concat(chunks).toString("utf8");
                resolve(s ? JSON.parse(s) : {});
            } catch (e) { reject(e); }
        });
        req.on("error", reject);
    });
}

function send(res, status, body, contentType) {
    var b = (typeof body === "string" || Buffer.isBuffer(body))
        ? body
        : JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type":   contentType || "application/json",
        "Content-Length": Buffer.byteLength(b)
    });
    res.end(b);
}

var server = http.createServer(function (req, res) {
    var url = req.url || "/";
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
        send(res, 200, INDEX_HTML, "text/html; charset=utf-8");
        return;
    }
    if (req.method === "GET" && url === "/info") {
        send(res, 200, BANNER);
        return;
    }
    if (req.method === "POST" && url === "/paste") {
        readBodyJson(req).then(function (body) {
            var text = String(body && body.text || "");
            if (!text) { send(res, 400, { error: "empty text" }); return; }
            if (text.length > 200000) { send(res, 413, { error: "too large (cap 200 KB)" }); return; }
            var stored = encryptAndStore(text);
            var token = issueToken({
                id: stored.id,
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24      // 24 h
            });
            console.log("[" + new Date().toISOString() + "] POST /paste id=" + stored.id +
                        " in=" + text.length + " stored=" + stored.stored +
                        " (" + stored.ratio + "% saved)");
            send(res, 200, {
                url: "/paste/" + stored.id,
                token: token,
                size: text.length,
                stored: stored.stored,
                compressionPct: stored.ratio
            });
        }).catch(function (e) { send(res, 400, { error: e.message }); });
        return;
    }
    var m = /^\/paste\/([0-9a-f]{16})$/.exec(url);
    if (req.method === "GET" && m) {
        var id = m[1];
        var auth = req.headers && (req.headers.authorization || req.headers.Authorization);
        var token = auth && auth.replace(/^Bearer\s+/i, "");
        var payload = verifyToken(token);
        if (!payload) { send(res, 401, { error: "invalid or expired token" }); return; }
        if (payload.id !== id)   { send(res, 403, { error: "token id mismatch" }); return; }
        var pt = readAndDecrypt(id);
        if (pt === null) { send(res, 404, { error: "paste not found" }); return; }
        console.log("[" + new Date().toISOString() + "] GET /paste/" + id + " (auth ok)");
        send(res, 200, { id: id, text: pt });
        return;
    }
    send(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, function () {
    var addr = server.address() || {};
    var bind = (addr.address || HOST) + ":" + (addr.port || PORT);
    console.log("=== paste server ===");
    console.log("  runtime: " + BANNER.runtime);
    console.log("  arch:    " + BANNER.arch);
    console.log("  cpu:     " + BANNER.cpu);
    console.log("  host:    " + BANNER.host);
    console.log("  store:   " + STORE_DIR);
    console.log("");
    console.log("  http://" + bind + "/");
    console.log("");
    console.log("  POST /paste   { text }   -> { url, token, ... }");
    console.log("  GET  /paste/<id>  Authorization: Bearer <jwt>");
});

process.on("SIGINT", function () {
    console.log("\nshutting down...");
    try { server.close(); } catch (e) {}
    process.exit(0);
});
