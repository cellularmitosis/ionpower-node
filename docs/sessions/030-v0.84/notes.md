# 2026-04-30 session 2: v0.84 batch

## Goals (in order)

1. **Babel `targets: { ie: 11 }` one-liner.** Standing follow-up
   from v0.81 — Babel-on-parse-failure currently uses default
   browserslist, which doesn't actually lower `async`/`await`. With
   `targets: { ie: 11 }` Babel transforms ES2017+ down to ES5-ish
   that SM45 can run.

2. **`wss://` (TLS WebSocket).** Wire `ws` and `WebSocketServer` to
   accept TLS sockets. Drop-in: replace `_Socket` with `_TLSSocket`
   for the WSS path.

3. **Vendor `axios`.** Real HTTP-client lib. Probably uses
   `http.Agent` more than our smokes do. Will surface bugs.

4. **Vendor `node-fetch`.** Sister of fetch. Pure JS,
   minimal deps in v2.x.

User said: "I'll re-run the tests later." So no conformance sweep
this session.

## Plan

Each step gets its own commit. v0.84 cuts after all four pass triad.
