// HTTP chunked Transfer-Encoding (server side) + keep-alive pipelining.

var http = require("http");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var reqsSeen = 0;
var server = http.createServer(function (req, res) {
    reqsSeen++;
    if (req.url === "/chunked") {
        // Stream out 3 chunks, no Content-Length → auto chunked TE.
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write("chunk one\n");
        res.write("chunk two\n");
        res.write("chunk three\n");
        res.end();
    } else if (req.url === "/explicit-chunked") {
        res.setHeader("Transfer-Encoding", "chunked");
        res.writeHead(200);
        res.write("aa");
        res.write("bb");
        res.end("cc");
    } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ping " + reqsSeen);
    }
});

var got1 = null, got2 = null, got3 = null, got4 = null;
var done = 0;

server.listen(0, "127.0.0.1", function () {
    var port = server.address().port;
    var base = "http://127.0.0.1:" + port;

    // Chunked auto: body is 3 chunks but client should see the concat
    fetch(base + "/chunked").then(function (r) { return r.text(); }).then(function (t) {
        got1 = t;
        if (++done === 4) server.close();
    });

    // Explicit chunked
    fetch(base + "/explicit-chunked").then(function (r) { return r.text(); }).then(function (t) {
        got2 = t;
        if (++done === 4) server.close();
    });

    // Plain buffered
    fetch(base + "/hello").then(function (r) { return r.text(); }).then(function (t) {
        got3 = t;
        if (++done === 4) server.close();
    });

    // Second plain (stresses "Connection: close" correctness)
    fetch(base + "/hello2").then(function (r) { return r.text(); }).then(function (t) {
        got4 = t;
        if (++done === 4) server.close();
    });
});

process.on("exit", function () {
    assert(got1 === "chunk one\nchunk two\nchunk three\n",
           "auto-chunked body assembled: " + JSON.stringify(got1));
    console.log("ok: auto-chunked response");
    assert(got2 === "aabbcc", "explicit chunked body: " + JSON.stringify(got2));
    console.log("ok: explicit chunked response");
    assert(got3 && got3.indexOf("ping") === 0, "plain response: " + JSON.stringify(got3));
    assert(got4 && got4.indexOf("ping") === 0, "plain response 2");
    console.log("ok: plain buffered responses (x2)");
    assert(reqsSeen === 4, "server saw 4 requests (got " + reqsSeen + ")");
    console.log("\nhttp_chunked smoke: all assertions passed");
});
