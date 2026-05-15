# ionpower-node express-chat-npm

The same anonymous chat board as [`demos/express-chat/`](../express-chat/),
except this version **installs its Express + handlebars + ws deps via
`npm install`** against the live registry — no vendored fallback. It's
the headline demo for the v0.97+ runtime, where `require('express')`
loads cleanly through the full npm-fetch → tinflate → require → V8
CallSite stack on real PowerPC hardware.

## Run it

On a fresh PowerPC Tiger box with the runtime installed at
`/opt/ionpower-node-0.97/` and matching SpiderMonkey at
`/opt/mozjs-45-ionpower-g3/`:

```bash
cd /opt/ionpower-node-0.97/share/ionpower-node/demos/express-chat-npm
/opt/ionpower-node-0.97/bin/node ../../test/vendor/nm/node_modules/npm/cli.js install
# ~4 min wall, ~70 packages, ~25 MB

/opt/ionpower-node-0.97/bin/node server.js 8080
```

The npm closure lands under `node_modules/` and re-uses across runs.

## Smoke test

In a separate shell once the server is up:

```bash
/opt/ionpower-node-0.97/bin/node client.js http://127.0.0.1:8080
```

Asserts: shape of `POST /api/post`, post round-trips in `GET /api/posts`,
tripcode determinism, rate-limit (HTTP 429), `since=N` filter, empty-text
rejection (HTTP 400). Exits 0 on success.

## Distinct from `demos/express-chat/`

| | `express-chat/` | `express-chat-npm/` |
|---|---|---|
| Express source | vendored at `test/vendor/express/` | installed via `npm install` |
| `require` style | `require(path.join(VENDOR_DIR, 'express'))` | `require('express')` |
| First-run cost | ~5 s | ~4 min (npm install) |
| Runtime exercises | Express middleware stack | … plus npm-fetch + tinflate + V8 CallSite |

## Architecture

| Layer | Implementation |
|---|---|
| HTTP server | `http.createServer(app)` + Express 4 |
| Routing | `app.get` / `app.post` |
| Body parsing | `express.json()` |
| Templates | `handlebars.compile` (custom `res.render` middleware) |
| Real-time push | `ws.WebSocketServer` on `PORT+1` |
| Tripcode | `crypto.createHash('sha256').update(secret).digest('base64').slice(0,10)` |
| Storage | in-memory ring buffer (`MAX_POSTS = 200`) |

## Why two versions?

The vendored `express-chat/` ships in every runtime tarball and gives a
five-second-to-screen "look, real Express on a G3" experience. The
`express-chat-npm/` variant is the proof that the runtime can host
modern Node code from npm directly — useful for kicking the tyres on
what works and what doesn't when you grab some random package off the
registry. It's larger to run, and the install can be slow over the
slow ports many Tiger boxes have, but the install itself is the demo.
