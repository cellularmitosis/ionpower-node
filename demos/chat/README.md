# ionpower-node chat — multi-client WebSocket demo

A minimal real-time chat server, designed to be the "yes, that's
running on a 1999 PowerBook G3" demo.

```
$ ssh ibookg37 './node demos/chat/server.js'
=== ionpower-node chat ===
  runtime: ionpower-node-0.73
  arch:    ppc (darwin)
  cpu:     PowerPC G3 (750)
  host:    ibookg37.home

  http://0.0.0.0:8080/
  ws://0.0.0.0:8081/  (the chat firehose)
```

Then, from any modern browser (or a Tiger PPC browser, for that matter):

> `http://ibookg37:8080/`

Multiple tabs / multiple devices all see each other's messages live.
The page header shows the runtime + host info pulled from the server,
so the "served by ionpower-node-0.71 on ibookg37 (ppc, 750)" banner
makes the point on every refresh.

## Commands

- `/nick yourname` — change your displayed name
- anything else — sent as a chat message

## What's exercised end-to-end

| Subsystem | Feature |
|---|---|
| `http.createServer` | HTML page + `/info` JSON banner |
| `ws.WebSocketServer` | RFC 6455 server with masked-frame parsing |
| `EventEmitter`        | per-socket `'message'`/`'close'`/`'error'`; broadcast to N clients |
| Event loop | `select()`-based, juggles N concurrent sockets + a 30 s heartbeat timer + the listening fds |
| `fs.readFileSync` | slurp the inline HTML at startup |
| `os.cpus()` / `os.hostname()` / `os.platform()` | runtime banner |
| `process.argv` / `process.env` | port + host overrides |
| `JSON.parse` / `stringify` | every message |
| Babel-on-parse-failure | if the server.js used modern syntax it would still run |

## Files

- `server.js` — ~150 lines, the runtime
- `index.html` — single self-contained page (CSS + JS inline, no
  external assets — works fine over slow connections, fine in Tiger
  PPC browsers, fine without JS frameworks)

## Sizing

`server.js` runs comfortably with several dozen connected clients on
a G3 600 MHz. The select() loop is the bottleneck above ~100 fds.
There's no shared state across processes; this is a single-process
chat — fine for the demo, would need a backing channel for real
production use.
