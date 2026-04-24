// Async http.createServer + http.request — self-contained, no network needed.

var http = require("http");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var serverReqs = [];
var server = http.createServer(function (req, res) {
    serverReqs.push({ method: req.method, url: req.url, headers: req.headers });
    if (req.method === "GET" && req.url === "/hello") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("hello, ionpower\n");
    } else if (req.method === "POST" && req.url === "/echo") {
        var chunks = [];
        req.on("data", function (c) { chunks.push(c); });
        req.on("end", function () {
            var body = Buffer.concat(chunks);
            res.writeHead(200, { "Content-Type": "application/octet-stream" });
            res.end(body);
        });
    } else {
        res.writeHead(404);
        res.end("not found");
    }
});

var getBody = "", getStatus = 0;
var postBody = "";
var errorsSeen = [];
var gotBoth = 0;

server.listen(0, "127.0.0.1", function () {
    var port = server.address().port;
    console.log("ok: http server listening on :" + port);

    // GET /hello
    var req = http.request({ hostname: "127.0.0.1", port: port, path: "/hello", method: "GET" }, function (res) {
        getStatus = res.statusCode;
        res.on("data", function (c) { getBody += String(c); });
        res.on("end", function () { if (++gotBoth === 2) server.close(); });
    });
    req.on("error", function (e) { errorsSeen.push(e); });
    req.end();

    // POST /echo with body
    var req2 = http.request({
        hostname: "127.0.0.1", port: port, path: "/echo", method: "POST",
        headers: { "Content-Type": "text/plain", "Content-Length": 4 }
    }, function (res) {
        res.on("data", function (c) { postBody += String(c); });
        res.on("end", function () { if (++gotBoth === 2) server.close(); });
    });
    req2.on("error", function (e) { errorsSeen.push(e); });
    req2.write("abcd");
    req2.end();
});

process.on("exit", function () {
    assert(errorsSeen.length === 0, "no errors: " + JSON.stringify(errorsSeen.map(function (e) { return e.message; })));
    assert(getStatus === 200, "GET status 200 (got " + getStatus + ")");
    assert(getBody === "hello, ionpower\n", "GET body: " + JSON.stringify(getBody));
    console.log("ok: GET /hello");

    assert(postBody === "abcd", "POST echoed body: " + JSON.stringify(postBody));
    console.log("ok: POST /echo (" + postBody.length + " bytes)");

    assert(serverReqs.length === 2, "server saw 2 requests");
    console.log("ok: server request log (" + serverReqs.length + ")");

    console.log("\nhttp_async smoke: all assertions passed");
});
