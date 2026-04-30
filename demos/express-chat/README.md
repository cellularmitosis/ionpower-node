# ionpower-node express-chat

An anonymous chat board powered by **real Express 4** running on a 1999
iBook G3 (PowerPC 750 900 MHz, Mac OS X 10.4.11 Tiger) under the
ionpower-node runtime.

The demo's punchline: a fully Express-shaped web app — middleware
stack, `express.json()`, `res.json()`, `req.query`, route params —
running on hardware from 1999 and a JS engine from Firefox 45.

Distinct from `demos/chat/` (which hand-rolls `http.createServer` + `ws`)
by exercising the Express middleware ecosystem end-to-end.

## Features

- **Anonymous posts** (8chan-style — no accounts, no login)
- **Tripcodes** — optional persistent identity: post with the same secret,
  get the same `!trip-hash` every time. Raw secret never stored or logged.
- **Real-time updates** via WebSocket push (WS server on PORT+1)
- **REST API** — `POST /api/post`, `GET /api/posts[?since=N]`
- **Anti-spam** — 1-post-per-2s rate limit per IP, 1024-char cap, empty-text rejection

## Run it

```bash
ssh ibookg37 'cd /Users/macuser/tmp/ionpower-node && ./node demos/express-chat/server.js 8080'
# wait ~5 s for Express require chain on G3
```

Then open `http://ibookg37:8080/` in any browser on the LAN.

## CLI smoke test

```bash
./node demos/express-chat/client.js http://ibookg37:8080
```

## Architecture

| Layer | Implementation |
|---|---|
| HTTP routing | Express 4.22.1 (vendored at `test/vendor/express/`) |
| Body parsing | `express.json()` (body-parser) |
| Template | Handlebars (`test/vendor/handlebars.js`) |
| WebSocket | `ws` built-in module, port+1 (same pattern as `demos/chat/`) |
| Tripcodes | `crypto.createHash('sha256')` |
| Storage | In-memory ring buffer, cap 200 posts |

WebSocket runs on `PORT+1` (default 8081) rather than the same port as
Express. The ionpower-node `ws` module doesn't implement the `noServer:true`
upgrade-hook mode yet; a separate listener is the clean workaround and
matches how `demos/chat/` does it.

## Vendoring

Express and its transitive dependencies live at `test/vendor/express/`.
Each dep is either:
- A proper npm package extracted from `npm pack` (Express itself,
  `body-parser`, `http-errors`, `depd`, `send`, `serve-static`, `accepts`,
  `negotiator`, `mime-types`, `mime-db`, `type-is`, `media-typer`,
  `content-disposition`, `raw-body`, `iconv-lite`, `proxy-addr`, `debug@2`,
  `ms@2.0.0`, `ms@2.1.3`, `mime@1.6`, `array-flatten`, `inherits`)
- A thin proxy wrapper (`index.js` + `package.json`) that re-exports the
  already-vendored single-file package from `test/vendor/<dep>.js`

The proxy trick keeps the existing `test/vendor/*.js` single-file packages
as the canonical source while making them resolvable via Node's
`node_modules/` traversal that Express uses internally.

## Known limitations

- WebSocket on PORT+1 (not same-port upgrade) — browser JS must connect
  to `ws://host:PORT+1/` explicitly (done automatically by `static/client.js`).
- In-memory only — posts lost on restart.
- No moderation, no persistence, no threads, no file uploads (intentional for
  the demo scope).

## Validated transcript on ibookg37 (iBook G3 900 MHz)

Server startup (Express require chain takes ~10 s on G3):

```
$ ./node demos/express-chat/server.js 8080
/Users/macuser/tmp/ionpower-node/test/vendor/express/node_modules/setprototypeof/index.js:3: mutating the [[Prototype]] of an object will cause your code to run very slowly; instead create the object with the correct initial [[Prototype]] value using Object.create
=== ionpower-node express-chat ===
  runtime: ionpower-node-0.81
  arch:    ppc (darwin)
  cpu:     PowerPC G3 (750)
  host:    ibookg37.home

  http://0.0.0.0:8080/

  POST /api/post  { text, name?, tripcode? }
  GET  /api/posts[?since=N]
  ws://0.0.0.0:8081/  (real-time push)
```

CLI smoke (in a second terminal on ibookg37):

```
$ ./node demos/express-chat/client.js http://127.0.0.1:8080

=== POST /api/post ===
status:        200
new post:      {"no":1,"name":"Anonymous","text":"hello board","ts":1777516649651}
ok  POST /api/post  shape

=== GET /api/posts ===
[{"no":1,"name":"Anonymous","text":"hello board","ts":1777516649651}]
ok  GET /api/posts  post appears in feed

=== POST with tripcode "secret" ===
new post:      {"no":2,"name":"alice","text":"hi","ts":1777516652133,"trip":"K7gNU3sdo+"}
ok  POST with tripcode  trip field present

=== POST same tripcode -> same trip-hash ===
{"no":3,"name":"alice","text":"echo","ts":1777516654412,"trip":"K7gNU3sdo+"}
ok  POST same tripcode -> same trip-hash (K7gNU3sdo+)

=== POST too fast (rate limit) ===
HTTP 429: Too Many Requests
ok  Rate limit -> HTTP 429

=== GET /api/posts?since=2 ===
[{"no":3,"name":"alice","text":"echo","ts":1777516654412,"trip":"K7gNU3sdo+"}]
ok  GET ?since=2  filtered correctly (1 posts)

=== POST empty text ===
HTTP 400: empty text
ok  POST empty text -> HTTP 400

express-chat smoke: ok (7 checks passed)
```

The SpiderMonkey warning about `setprototypeof` mutating `[[Prototype]]` is a
harmless performance advisory from SM45; it doesn't affect correctness.
