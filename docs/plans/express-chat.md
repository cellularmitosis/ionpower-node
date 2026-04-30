# Plan: `demos/express-chat/`

A real Express app running on the runtime — multi-user chat room with
session login, JSON API, and live WebSocket push. Distinct from
[`demos/chat/`](../../demos/chat/) (which is hand-written `http.createServer`
+ `ws`) by exercising the **Express middleware ecosystem** as ordinary
Node developers know it.

The demo's hook: "POST `{ "username": "alice" }` to `/login`, see the
`sess` cookie, GET `/`, type a message in the page, watch every other
browser tab on the LAN see it pushed in real time — all from a 1999
iBook G3 running Express."

## Behaviour

### HTTP routes (Express)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `GET`  | `/`              | none | — | rendered `index.hbs` (showing nick if logged in, login form if not) |
| `GET`  | `/info`          | none | — | JSON banner `{ runtime, arch, cpu, host, started, online }` |
| `POST` | `/login`         | none | `{ username }` | sets `sess=<signed>` cookie, redirects to `/` |
| `POST` | `/logout`        | session | — | clears cookie, redirects to `/` |
| `GET`  | `/api/messages`  | none | — | JSON `[{ id, nick, text, ts }, ...]` (last 100) |
| `POST` | `/api/messages`  | session | `{ text }` | JSON of the new message; broadcasts to WS subscribers |
| `GET`  | `/static/*`      | none | — | static asset (`style.css`, `client.js`) |

### WebSocket — `/ws` (upgraded from same port as Express)

Server → client frames:
- `{ type: "history", messages: [...] }` on connect
- `{ type: "msg", message: {...} }` whenever any client posts

Client → server frames: ignored. Posting goes through `POST /api/messages`
(so it routes through Express auth). The WS is read-only — that keeps
the auth boundary single-source-of-truth in the HTTP layer.

### Auth

- Username-only (no password). `/login` accepts any non-empty
  alphanumeric `username` ≤ 24 chars; that becomes the session subject.
- Session cookie is signed (HMAC-SHA256) with a per-startup secret
  (`crypto.randomBytes(32)`). Restart = all sessions invalid. Same
  pattern as `demos/paste/`.
- `requireAuth` middleware reads + verifies the cookie, sets `req.user`,
  or returns 401. Used by `POST /api/messages` and `POST /logout`.

### Storage

In-memory `Array<Message>` ring buffer capped at 100. Lost on restart.
That's fine for a demo.

```js
{ id: <8 hex bytes>, nick: <string>, text: <string≤1024>, ts: <unix ms> }
```

## File layout

```
demos/express-chat/
├── server.js          ~250 LOC — Express app + ws upgrade
├── views/
│   └── index.hbs      Handlebars page
├── static/
│   ├── style.css
│   └── client.js      browser-side: WS connect, render, post via fetch
├── client.js          ~80 LOC — CLI smoke (login + post + GET /api/messages)
└── README.md
```

Patterns to copy from existing demos:
- Banner + `/info` route → see `demos/chat/server.js`
- Ephemeral signing key + cookie shape → see `demos/paste/server.js`
- HTML structure + dark theme → see either of the above
- CLI smoke shape → see `demos/paste/client.js`

## Dependency vendoring

Start by inventorying what's in `test/vendor/` and `test/vendor/nm/node_modules/`.
Express's runtime deps (current 4.x line) are:

| Package | Likely status | Action |
|---|---|---|
| `accepts` | already vendored | use as-is |
| `array-flatten` | check | drop in if missing |
| `body-parser` | partial — vendor `body-parser` proper | tarball from npm |
| `content-disposition` | vendored | use |
| `content-type` | vendored | use |
| `cookie` | vendored | use |
| `cookie-signature` | vendored | use |
| `debug` | not vendored — small wrapper, can stub | write 10-line shim or vendor |
| `depd` | not vendored | small, stub or vendor |
| `encodeurl` | not vendored | tiny, vendor |
| `escape-html` | tiny, may be vendored | check |
| `etag` | not vendored | vendor |
| `finalhandler` | not vendored | vendor |
| `fresh` | not vendored | small, vendor |
| `http-errors` | not vendored | vendor |
| `merge-descriptors` | not vendored | tiny, vendor |
| `methods` | not vendored | tiny, vendor (just an array) |
| `mime` / `mime-types` | vendored (mime-types in `vendor/`) | use |
| `on-finished` | vendored | use |
| `parseurl` | not vendored | small, vendor |
| `path-to-regexp` | not vendored | medium, vendor |
| `proxy-addr` | not vendored | not strictly needed; can stub |
| `qs` | vendored (qs-v6.js / qs.js) | check API match |
| `range-parser` | not vendored | not needed for chat (we don't do Range requests); stub |
| `safe-buffer` | built-in shim (per `README.md`) | use |
| `send` | not vendored | medium, vendor (only needed if we use serve-static) |
| `serve-static` | not vendored | small wrapper around send; vendor or hand-roll |
| `setprototypeof` | not vendored | trivial, stub |
| `statuses` | vendored | use |
| `type-is` | vendored? check | vendor if missing |
| `utils-merge` | not vendored | trivial, stub |
| `vary` | vendored | use |

For the missing pieces: `npm pack express@4` followed by `npm pack <each-dep>`
into `test/vendor/express/node_modules/<dep>/`, mirroring the layout we
already use for `test/vendor/elliptic/node_modules/`.

A few items can be stubbed instead of vendored:
- `setprototypeof` — `Object.setPrototypeOf` is native; trivial 5-line shim
- `utils-merge` — `Object.assign`-equivalent for own props
- `methods` — just `['get', 'post', 'put', 'delete', ...]`
- `range-parser` — return null (we don't serve Range)
- `proxy-addr` — return req.socket.remoteAddress

Express handlebars rendering (the `app.set('view engine', 'hbs')` path)
needs `express-handlebars` or `consolidate`. Simpler: render manually via
the already-vendored `handlebars`, with a thin Express middleware:

```js
app.use((req, res, next) => {
    res.render = (name, ctx) => {
        var src = fs.readFileSync(path.join(VIEWS, name + ".hbs"), "utf8");
        var html = handlebars.compile(src)(ctx);
        res.set("Content-Type", "text/html; charset=utf-8").send(html);
    };
    next();
});
```

WS upgrade: Express's `app.listen()` returns the underlying `http.Server`.
Hook `'upgrade'` on it and route `/ws` paths through our existing `ws`
package (already vendored, exercised by `demos/chat/`).

## Validation

Three smokes, in order of importance:

### 1. CLI client (`client.js`)

Runs end-to-end, no browser. Spawns / connects to a running server. Should
exit 0 on success.

```
=== POST /login ===
sess cookie:   sess=alice.eyJleHAiOjE3...
status:        200

=== GET /api/messages (empty) ===
[]

=== POST /api/messages (auth) ===
{ id: "...", nick: "alice", text: "hello express", ts: ... }

=== GET /api/messages (one entry) ===
[{ id: "...", nick: "alice", text: "hello express", ts: ... }]

=== unauth POST /api/messages (no cookie) ===
401 unauthorized

express-chat smoke: ok
```

### 2. Browser end-to-end on ibookg37

Open `http://ibookg37:8080/` in a Mac browser. Login as `alice`.
Type "hello". Open second tab, login as `bob`. Type "hi alice". Both
tabs see both messages. Tooling: just visual.

### 3. Two-client WS broadcast

Like the `demos/chat/` 3-client smoke but going through Express's
`POST /api/messages` rather than direct WS write. Verifies the
auth → broadcast pipeline.

## Hand-off briefing for an implementer

If a Sonnet subagent picks this up, brief them with:

1. **The demo's success bar**: the three smokes above all pass on
   `ibookg37`, in the same TAP-style output shape as `demos/paste/client.js`.
2. **Style references**: match the dark-theme CSS from `demos/chat/index.html`
   and `demos/paste/index.html`. The runtime banner at the top of the page
   pulled from `/info` is non-negotiable — that's the demo's punchline.
3. **Vendor in `test/vendor/express/node_modules/<dep>/` — never modify Express's source**.
   If something doesn't run, the fix is in our runtime, not in Express.
4. **Stop and report if a fix requires touching `src/node_compat/`**. Do
   not silently patch C++ — that's a runtime change with triad-build
   implications.
5. **Known gotchas from prior demos**:
   - `Buffer.from(req.body)` after `express.json()` — `req.body` is
     already an object, not raw bytes.
   - Our `http.createServer` parses the request line + headers but
     leaves the body for the handler. `body-parser` reads `req` as a
     Readable stream — that's wired in our http.
   - WS upgrade: don't try to share the same `http.createServer` if
     Express's listen has weirdness; fall back to `:8081` like
     `demos/chat/` does. Document the choice in `README.md`.
   - The Babel-on-parse-failure path lowers `async function` /
     `await` (per v0.77+), so the test files can use modern syntax.
     `import.meta` and dynamic `import()` work too (per v0.78). But
     **CJS modules can't synchronously export a top-level-await result**
     — keep Express's setup synchronous.
6. **Save session work to** `docs/sessions/<date>-session-N-express-chat/`
   per CLAUDE.md.

## Non-goals

- File uploads (multipart) — our http body handling is simple and Express's
  multer adapter would be more work than the demo's worth.
- HTTPS — TLS is on the [`docs/plan-tls.md`](../plan-tls.md) roadmap.
  This demo is HTTP-only.
- Persisted messages — in-memory ring is fine.
- Multi-room — one global room.
- Rich text / markdown rendering — plain text, server-side HTML-escapes.

## Estimated cost

| Phase | Estimate |
|---|---|
| Vendor + stub express's deps | 1.5 h |
| `server.js` + `views/` + `static/` | 1.5 h |
| Debug what doesn't work (the unknown) | 2-4 h |
| `client.js` smoke + browser end-to-end | 1 h |
| README + commit | 0.5 h |
| **Total** | **6-8 h** |

The "debug what doesn't work" line is the variance. Express might hit
a `path-to-regexp` edge case, a `body-parser` chunked-stream issue, or
something in our `http.cpp` we don't expose. Each gap is potentially a
runtime-side fix that needs a triad rebuild. Worst case: 2-3 sessions.

## On using a Sonnet subagent

Honest read:

**Yes, with a tight brief.** A Sonnet 4.5 subagent has the JS chops and the
patience for the mechanical vendoring + Express plumbing. With this plan
+ the demos/chat / demos/paste references + CLAUDE.md, the bulk of the
work — phases 1, 2, 4, 5 above — is well-bounded.

**Where I'd worry**: phase 3, "debug what doesn't work." Express's
behavior assumes a Node http parser + a particular req/res shape that
might not match ours pixel-for-pixel. When that bites, the fix often
requires reading `src/node_compat/http.cpp` or `globals.cpp` and
deciding "is this an Express assumption or a real gap in our http?"
That's project-context work that a fresh Sonnet won't have unless we
brief it heavily. Add the brief: "if Express trips over our http,
write down the symptom and stop — don't try to fix the runtime
yourself." Then a follow-up session (with you driving the runtime
fix) closes the loop.

**Net**: I'd hand off phases 1, 2, 4, 5 to Sonnet with the plan above.
Reserve phase 3 (or its triggers) for a session where someone
(you, me) can make runtime calls with full context. Sonnet's
output should be either "done end-to-end, here's the demo running"
or "got to point X, blocked on Y in our http stack — see notes."

That keeps the high-leverage work (phases 1+2+4+5 = ~5 hours) off
your plate while parking the riskier phase 3 in a place where it
gets the right kind of attention.
