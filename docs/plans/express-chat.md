# Plan: `demos/express-chat/`

A real Express app running on the runtime — **anonymous chat board**
in the 4chan / 8chan style. No login, no accounts, no session cookies;
everyone is "Anonymous" by default with optional tripcodes for
repeat-poster identity. One global feed, scrollback, real-time updates.

The demo's hook: "Tail-f a public chat from a 1999 iBook G3, post
without ever signing up. Real Express, real WebSocket push, real
node app shape — works in any browser tab on the LAN."

Distinct from [`demos/chat/`](../../demos/chat/) (which is hand-rolled
`http.createServer` + `ws`) by exercising the **Express middleware
ecosystem** as ordinary Node developers know it.

## Behaviour

### HTTP routes (Express)

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/`              | — | rendered `index.hbs` (the feed page) |
| `GET`  | `/info`          | — | JSON banner `{ runtime, arch, cpu, host, started, online }` |
| `POST` | `/api/post`      | `{ text, name?, tripcode? }` | JSON of the new post; broadcasts to WS subscribers |
| `GET`  | `/api/posts`     | — | JSON `[{ no, name, trip?, text, ts }, ...]` (last 200) |
| `GET`  | `/api/posts?since=N` | — | JSON of posts with `no > N` (for polling-fallback clients) |
| `GET`  | `/static/*`      | — | static asset (`style.css`, `client.js`) |

### WebSocket — `/ws` (upgraded from same port as Express)

Server → client frames:
- `{ type: "history", posts: [...] }` on connect (last 50)
- `{ type: "post", post: {...} }` whenever any client posts

Client → server frames: ignored. Posting goes through `POST /api/post`,
which broadcasts. Single source of truth for the post pipeline.

### Tripcodes (8chan-style)

Optional `tripcode` field on POST. If set:

1. Server computes `trip = base64(sha256(tripcode))[:10]`.
   That's the **persistent anonymous identity**: anyone who posts with
   the same tripcode shows the same trip-hash.
2. Stored on the post as `trip` (string) or absent.
3. **The raw tripcode is never logged or echoed.** Discarded after hash.

Renders as `Anonymous !trip-hash` or `<name> !trip-hash`.

### Anti-spam (minimum viable)

- 1024-character cap on `text`.
- 24-character cap on `name`.
- One-per-2-seconds rate limit per IP. In-memory `Map<ip, lastPostMs>`.
- Posts containing only whitespace rejected (HTTP 400).

### Storage

In-memory ring buffer capped at 200. Lost on restart.

```js
{ no: <int>, name: <string>, trip?: <string>, text: <string>, ts: <unix ms> }
```

Sequential `no` starting at 1. Posts referenced as `>>N` in text get
auto-linkified client-side.

## File layout

```
demos/express-chat/
├── server.js          ~200 LOC — Express app + ws upgrade
├── views/
│   └── index.hbs      Handlebars page (server-rendered initial state)
├── static/
│   ├── style.css
│   └── client.js      browser-side: WS connect, render, post via fetch
├── client.js          ~80 LOC — CLI smoke (post + GET + auto-bump)
└── README.md
```

Patterns to copy from existing demos:
- Banner + `/info` route → see `demos/chat/server.js`
- HTML structure + dark theme → either of `demos/chat/` or `demos/paste/`
- CLI smoke shape → see `demos/paste/client.js`
- WS upgrade off the same `http.Server` → see `demos/chat/server.js`

## Dependency vendoring

Auth is gone, so the vendor footprint shrinks. Express's runtime deps:

| Package | Status | Action |
|---|---|---|
| `accepts` | already vendored | use |
| `array-flatten` | check | drop in if missing |
| `body-parser` | partial | npm-pack the proper one |
| `content-disposition` | vendored | use |
| `content-type` | vendored | use |
| `debug` | not vendored | 10-line shim or vendor |
| `depd` | not vendored | small, stub or vendor |
| `encodeurl` | not vendored | tiny, vendor |
| `escape-html` | check | tiny, vendor if missing |
| `etag` | not vendored | vendor |
| `finalhandler` | not vendored | vendor |
| `fresh` | not vendored | small, vendor |
| `http-errors` | not vendored | vendor |
| `merge-descriptors` | not vendored | tiny, vendor |
| `methods` | not vendored | trivial (just an array) |
| `mime-types` | vendored | use |
| `on-finished` | vendored | use |
| `parseurl` | not vendored | small, vendor |
| `path-to-regexp` | not vendored | medium, vendor |
| `qs` | vendored | check API match |
| `range-parser` | not strictly needed | stub returning null |
| `safe-buffer` | built-in shim | use |
| `send` | not strictly needed (no static-file complexity) | hand-roll a 30-line static handler |
| `serve-static` | drop | hand-roll instead |
| `setprototypeof` | trivial | shim |
| `statuses` | vendored | use |
| `type-is` | check | vendor if missing |
| `utils-merge` | trivial | shim |
| `vary` | vendored | use |

**No** `cookie` / `cookie-signature` / session middleware needed.

`npm pack express@4` followed by per-dep `npm pack` into
`test/vendor/express/node_modules/<dep>/`, mirroring
`test/vendor/elliptic/node_modules/`.

For Handlebars rendering, skip `express-handlebars` — render manually
via the already-vendored `handlebars` with a one-liner middleware:

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

WS upgrade: Express's `app.listen()` returns an `http.Server`. Hook
`'upgrade'` on it and route `/ws` paths through the already-vendored
`ws` package.

## Validation

Three smokes in order of importance.

### 1. CLI client (`client.js`)

End-to-end, no browser. Runs against a server on `127.0.0.1`. Exits 0
on success.

```
=== POST /api/post ===
status:        200
new post:      { no: 1, name: "Anonymous", text: "hello board", ts: ... }

=== GET /api/posts ===
[{ no: 1, name: "Anonymous", text: "hello board", ts: ... }]

=== POST with tripcode "secret" ===
new post:      { no: 2, name: "alice", trip: "9a2f4e1b3c", text: "hi", ts: ... }

=== POST same tripcode → same trip-hash ===
{ no: 3, name: "alice", trip: "9a2f4e1b3c", text: "echo", ts: ... }

=== POST too-fast (rate limit) ===
HTTP 429: Too Many Requests

=== GET /api/posts?since=2 ===
[{ no: 3, ... }]

=== POST empty text ===
HTTP 400: empty text

express-chat smoke: ok
```

### 2. Browser end-to-end on ibookg37

Open `http://ibookg37:8080/` in a Mac browser. Type "hello world",
hit post. Open second tab. Post "second post". Both tabs see both
posts in real time. Type `>>1` in a third post, click the auto-link,
scrolls to post 1.

### 3. Two-client WS broadcast

Connect two `ws://ibookg37:8080/ws` clients. POST via HTTP from a
third process. Both WS clients receive the broadcast frame.

## Hand-off briefing for an implementer

If a Sonnet subagent picks this up, brief them with:

1. **The demo's success bar**: the three smokes above all pass on
   `ibookg37`, in the same TAP-style output shape as
   `demos/paste/client.js`.
2. **Style references**: match the dark-theme CSS from
   `demos/chat/index.html` and `demos/paste/index.html`. Header
   banner pulled from `/info` showing real CPU + host info — that's
   the demo's punchline.
3. **Vendor in `test/vendor/express/node_modules/<dep>/` — never modify Express's source.**
   If something doesn't run, the fix is in our runtime, not in
   Express.
4. **Stop and report if a fix would require touching `src/node_compat/`.**
   Do NOT silently patch C++ — that's a runtime change with
   triad-build implications.
5. **First step before tarballing**: `ls test/vendor/` against the
   dependency table above and update the missing-vs-have split. No
   point in re-vendoring what's already there.
6. **Known gotchas from prior demos**:
   - Our `http.createServer` parses request line + headers but leaves
     the body as a Readable stream — `body-parser` / `express.json()`
     should consume it normally.
   - WS upgrade: if hooking it on the same `http.Server` gives weird
     behaviour, fall back to `:8081` like `demos/chat/` does.
     Document the choice in `README.md`.
   - The Babel-on-parse-failure path lowers `async function` /
     `await` (per v0.77+), so freely use them. `import.meta` and
     dynamic `import()` work too (per v0.78). But CJS modules can't
     synchronously export a top-level-await result — keep Express's
     setup synchronous.
   - SHA-256 for tripcodes is `crypto.createHash('sha256')` — works
     fine on all triad arches.
7. **Save session work to** `docs/sessions/<date>-session-N-express-chat/`
   per CLAUDE.md ("Document everything").

## Non-goals

- File / image uploads (multipart). Modern boards lean on this but it
  more than doubles the work; text-only is fine for the demo.
- HTTPS / TLS — see [`docs/plan-tls.md`](../plan-tls.md).
- Persistence — in-memory ring is fine.
- Multi-board / threads — single global feed.
- Markdown rendering — plain text, server-side HTML-escapes; only
  `>>N` auto-linking.
- Moderation / mod tools — we explicitly leave that to a future demo.

## Estimated cost

| Phase | Estimate |
|---|---|
| Inventory `test/vendor/` + tarball missing Express deps | 1 h |
| `server.js` + `views/` + `static/` | 1.5 h |
| Debug what doesn't work (the unknown) | 1-3 h |
| `client.js` smoke + browser end-to-end | 0.5 h |
| README + commit | 0.5 h |
| **Total** | **4.5-6.5 h** |

The "debug" line is still the variance, but the auth-less design cuts
the dependency surface area roughly in half compared to a
sessions-required version, so fewer chances to trip on a vendor edge
case.

## On using a Sonnet subagent

Honest read after the simplification:

**Good fit.** The auth-less design plus the existing demos as templates
brings this well within Sonnet 4.5's bandwidth. The mechanical phases
(vendor inventory + Express deps, app structure, smoke, README) are
~3.5 hours of well-bounded work with the plan and references in hand.

**Where I'd still worry**: the "debug what doesn't work" phase. Express
makes assumptions about Node's `http` parser + req/res shape that
might not match ours pixel-for-pixel. When that bites, the right move
is to read `src/node_compat/http.cpp` or `globals.cpp` and decide
"Express assumption or real gap?" — that's project-context work a
fresh Sonnet won't have without a heavy briefing.

**Mitigation**: brief the agent with this plan + the existing demos +
CLAUDE.md, and add a hard rule: **if Express trips and the fix would
touch `src/node_compat/`, write the symptom down + stop**. Don't try
to patch C++. Then a follow-up session (with full project context)
closes the loop on the runtime side.

End-state from Sonnet should be either "demo runs end-to-end, here's
the smoke output" or "got to phase X, blocked on Y in our http stack —
here's the diagnosis." Both useful; the first lands the demo, the
second turns into a runtime fix in a future session.

That keeps the high-leverage mechanical work (~3.5 h) off your plate
while parking the runtime-touching work in a place where it gets the
right kind of attention.
