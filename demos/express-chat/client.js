// express-chat/client.js — CLI smoke test for the express-chat server.
//
// Runs against a live server. Exercises:
//   POST /api/post      -> verify response shape
//   GET  /api/posts     -> verify post appears in feed
//   POST with tripcode  -> verify trip-hash in response
//   POST same tripcode  -> verify trip-hash matches
//   POST too fast       -> verify HTTP 429 (rate limit)
//   GET  /api/posts?since=N -> verify filtering
//   POST empty text     -> verify HTTP 400
//
// Usage:
//   ./node demos/express-chat/client.js [url]
//   default url: http://127.0.0.1:8080
//
// Exit 0 on full success; exit 1 with diagnostic on first failure.

var BASE = process.argv[2] || "http://127.0.0.1:8080";

var PASS = 0;
var FAIL = 0;

function ok(label) {
    PASS++;
    console.log("ok  " + label);
}
function fail(label, detail) {
    FAIL++;
    console.error("FAIL " + label);
    if (detail) console.error("     " + detail);
}

function j(r) {
    return r.json().then(function (body) { return { status: r.status, ok: r.ok, body: body }; });
}

function post(path, bodyObj) {
    return fetch(BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj)
    }).then(j);
}

function get(path) {
    return fetch(BASE + path).then(j);
}

function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Chain all tests sequentially
var chain = Promise.resolve();

// ---- Phase 1: POST /api/post basic ----
chain = chain.then(function () {
    console.log("\n=== POST /api/post ===");
    return post("/api/post", { text: "hello board" });
}).then(function (r) {
    if (r.status !== 200) { fail("POST status 200", "got " + r.status); return Promise.reject(new Error("abort")); }
    var p = r.body;
    if (!p || typeof p.no !== "number") { fail("post has no", JSON.stringify(p)); return Promise.reject(new Error("abort")); }
    if (p.text !== "hello board")       { fail("post text roundtrips", JSON.stringify(p.text)); return Promise.reject(new Error("abort")); }
    if (p.name !== "Anonymous")         { fail("default name Anonymous", p.name); return Promise.reject(new Error("abort")); }
    console.log("status:        " + r.status);
    console.log("new post:      " + JSON.stringify(p));
    ok("POST /api/post — shape");
    return p;
});

// ---- Phase 2: GET /api/posts ----
chain = chain.then(function (p1) {
    console.log("\n=== GET /api/posts ===");
    return get("/api/posts").then(function (r) {
        if (r.status !== 200) { fail("GET /api/posts status", "got " + r.status); return Promise.reject(new Error("abort")); }
        var list = r.body;
        if (!Array.isArray(list)) { fail("GET /api/posts returns array", typeof list); return Promise.reject(new Error("abort")); }
        var found = list.filter(function (x) { return x.no === p1.no; });
        if (found.length === 0) { fail("post no=" + p1.no + " in feed", "not found"); return Promise.reject(new Error("abort")); }
        console.log(JSON.stringify(list.slice(-3)));
        ok("GET /api/posts — post appears in feed");
        return p1;
    });
});

// Wait for rate limiter to reset before posting again
chain = chain.then(function (p1) {
    return sleep(2100).then(function () { return p1; });
});

// ---- Phase 3: POST with tripcode ----
var post3;
chain = chain.then(function (p1) {
    console.log("\n=== POST with tripcode \"secret\" ===");
    return post("/api/post", { text: "hi", name: "alice", tripcode: "secret" });
}).then(function (r) {
    if (r.status !== 200) { fail("POST with tripcode status", "got " + r.status + " " + JSON.stringify(r.body)); return Promise.reject(new Error("abort")); }
    var p = r.body;
    if (!p.trip || typeof p.trip !== "string") { fail("trip field present", JSON.stringify(p)); return Promise.reject(new Error("abort")); }
    console.log("new post:      " + JSON.stringify(p));
    ok("POST with tripcode — trip field present");
    post3 = p;
    return p.trip;
});

// Wait for rate limiter to reset
chain = chain.then(function (trip1) {
    return sleep(2100).then(function () { return trip1; });
});

// ---- Phase 4: Same tripcode -> same trip-hash ----
var savedTrip;
chain = chain.then(function (trip1) {
    savedTrip = trip1;
    console.log("\n=== POST same tripcode -> same trip-hash ===");
    return post("/api/post", { text: "echo", name: "alice", tripcode: "secret" });
}).then(function (r) {
    if (r.status !== 200) { fail("POST echo status", "got " + r.status + " " + JSON.stringify(r.body)); return Promise.reject(new Error("abort")); }
    var p = r.body;
    if (p.trip !== savedTrip) {
        fail("trip-hash matches", "got " + p.trip + " expected " + savedTrip);
        return Promise.reject(new Error("abort"));
    }
    console.log(JSON.stringify(p));
    ok("POST same tripcode -> same trip-hash (" + savedTrip + ")");
    return p.no;
});

// ---- Phase 5: Rate limit (post too fast — immediately after previous) ----
chain = chain.then(function (lastNo) {
    console.log("\n=== POST too fast (rate limit) ===");
    return post("/api/post", { text: "spam" });
}).then(function (r) {
    if (r.status !== 429) {
        fail("HTTP 429 on rapid post", "got " + r.status);
        return Promise.reject(new Error("abort"));
    }
    console.log("HTTP 429: " + (r.body.error || "Too Many Requests"));
    ok("Rate limit -> HTTP 429");
});

// ---- Phase 6: GET /api/posts?since=N ----
chain = chain.then(function () {
    var sinceNo = post3 ? post3.no : 1;
    console.log("\n=== GET /api/posts?since=" + sinceNo + " ===");
    return get("/api/posts?since=" + sinceNo).then(function (r) {
        if (r.status !== 200) { fail("GET since status", "got " + r.status); return Promise.reject(new Error("abort")); }
        var list = r.body;
        var bad = list.filter(function (p) { return p.no <= sinceNo; });
        if (bad.length > 0) { fail("since filter excludes old posts", JSON.stringify(bad[0])); return Promise.reject(new Error("abort")); }
        console.log(JSON.stringify(list));
        ok("GET ?since=" + sinceNo + " — filtered correctly (" + list.length + " posts)");
    });
});

// Wait for rate limiter to reset before empty-text test
chain = chain.then(function () {
    return sleep(2100);
});

// ---- Phase 7: POST empty text -> HTTP 400 ----
chain = chain.then(function () {
    console.log("\n=== POST empty text ===");
    return post("/api/post", { text: "   " });
}).then(function (r) {
    if (r.status !== 400) { fail("empty text -> 400", "got " + r.status); return Promise.reject(new Error("abort")); }
    console.log("HTTP 400: " + (r.body.error || "empty text"));
    ok("POST empty text -> HTTP 400");
});

// ---- Summary ----
chain = chain.then(function () {
    console.log("\nexpress-chat smoke: ok (" + PASS + " checks passed)");
    process.exit(0);
}).catch(function (e) {
    if (e && e.message !== "abort") {
        console.error("FAIL:", e.message);
        if (e.stack) console.error(e.stack);
    }
    console.error("\nexpress-chat smoke: FAILED (" + FAIL + " failed, " + PASS + " passed)");
    process.exit(1);
});
