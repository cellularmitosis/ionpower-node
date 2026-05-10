# Node target version + `process.version` policy

**Status:** Decided 2026-05-10.

**Decision:** ionpower-node's `process.version` will report `v10.24.1`
(the last release of the Node 10.x line). The runtime's own
identity moves into `process.versions['ionpower-node']`.
For the foreseeable future, **Node 10 is the parity target** the
project measures itself against.

## What is `process.version`?

In a Node program, `process.version` is the runtime's version
string. Real Node sets it to a value like `v22.13.0` or `v18.19.0` —
note the leading `v` is part of the string. JavaScript code reads it
to ask the runtime "what version of Node are you?"

Lots of libraries branch on this. The pattern looks like:

```js
if (parseInt(process.version.slice(1).split('.')[0]) >= 14) {
  // use the new fast path
} else {
  // use the old slow path
}
```

Some tools go further. npm 6.14.18 feeds `process.version` straight
into a real semver parser via its `engines.node` field
(`>=6 <11`) — and rejects with a `TypeError: Invalid Version` if
the string isn't shaped like a semver.

## What was it before this decision?

`ionpower-node-0.86`. The original
[`docs/plan.md`](../plan.md) explicitly said "ours, not Node's" — a
deliberate divergence so `process.version` named our project, not a
fictional Node release we'd implicitly be claiming compatibility
with.

The cost showed up in the npm 6.14.18 bring-up
([session 2 notes](../sessions/2026-05-09-session-2-npm-6-bootstrap/notes.md)):
the very first thing npm did was reject `ionpower-node-0.86` as
non-semver. The same string-parsing pattern shown above silently
falls through `parseInt → NaN → "old Node" branch` in any library
that gates on Node major version. Some libraries throw outright; many
just take a slow / less-correct path.

## Why `v10.24.1` specifically?

Three constraints lined up on Node 10:

1. **npm 6.14.18 accepts it.** npm's manifest declares
   `engines.node: ">=6 <11"`. Anything in 6.x / 8.x / 10.x passes;
   12.x and up don't. Of those, 10.24.1 is the freshest.
2. **It's the last pre-`async-iterator-everywhere` Node.** Node 10
   shipped April 2018, EOL April 2021. The Node 10 surface is
   already mostly what ionpower-node implements (real event loop,
   `fs`/`http`/`https`/`net`/`tls`/`dgram`/`crypto`/`zlib`,
   WHATWG Streams, top-level await via Babel).
3. **Closing the remaining Node 10 gaps is tractable.** What's
   missing today is mostly small individual fs / process additions,
   not structural redesign — the npm 6 experiment showed the gap
   list plateaus quickly.

A higher target like Node 14 or Node 18 would force us to
implement async-iterator-heavy fs APIs, native fetch, modern crypto
KeyObject internals, ESM-as-first-class modules, and other
substantial surface we haven't even started on.

A lower target like Node 8 would mean rejecting libraries that need
`util.promisify` (Node 8.0) or `Buffer.from` semantics (Node 6.0)
that we already implement.

## Other options we considered

- **Honest** (`ionpower-node-0.86` — what we have today). Loses on
  every library that does shape-aware parsing. npm 6 rejects on the
  spot. Not a real option going forward.
- **Semver-shaped honest** (`v0.86.0`). Looks like semver but is
  "Node 0," which Node never shipped. Libraries gating on
  `process.version >= ...` reject as too old. Doesn't help us.
- **Lie outright** (`v10.24.1`). What we picked. Loses our identity
  in `process.version`, but `process.versions['ionpower-node']`
  still carries it for any caller that cares.
- **SemVer build-metadata hybrid** (`v10.24.1+ionpower-node-0.86`).
  Per SemVer 2.0, `+...` is "build metadata" and is ignored when
  comparing versions. `semver.satisfies(...)` would still treat
  this as 10.24.1. Theoretically the cleanest answer. **Rejected**
  because we have no way of knowing how every random library's
  string-parsing handles the `+` — `parseInt('v10.24.1+...'.slice(1)
  .split('.')[0])` is fine, but `String#split('.')[2]` would yield
  `1+ionpower-node-0` instead of `1`, and any code that compares
  patch numbers as integers would break in an opaque way. The
  honest+structured form costs a long tail of weird breakage we
  won't notice until something downstream silently misbehaves.
- **SemVer pre-release hybrid** (`v10.24.1-ionpower-node-0.86`).
  Same shape, but using the `-...` pre-release tag. SemVer
  precedence rule says `v10.24.1-anything` sorts BELOW `v10.24.1`
  proper. npm specifically strips this with `replace(/-.*$/, '')`
  before comparing, but other tooling won't. Rejected for the
  same library-string-parsing reason as the build-metadata form.

The tradeoff in plain English: any "honest+structured" version is
strictly more truthful but creates a long tail of subtle bugs in
downstream code we can't audit. Lying outright is structurally
simpler — every library sees a value Node has actually shipped.

## How identity moves

After this change:

- `process.version` → `'v10.24.1'`
- `process.versions` → `{ node: '10.24.1', 'ionpower-node': '0.86' }`
  (matches Node's own `process.versions.v8`, `process.versions.openssl`
  shape)
- `process.versions['ionpower-node']` is the canonical place to ask
  "what version of *us* is running". Bump it when our VERSION moves
  in the Makefile.

Any library that wants to detect ionpower-node specifically
(unlikely in practice, since none of the 660+ vendored libraries do
today) can probe `process.versions['ionpower-node']`.

## The roadmap implication

The `process.version` decision suggests a broader project-level
framing for what ionpower-node is, going forward:

> **Pick a Node version as the parity target. Build until the
> runtime actually achieves parity with that version. Then bump
> the target to the next version. Rinse and repeat, marching
> through the Node release line.**

This gives the project a measurable, externally-meaningful
yardstick instead of "feature X happens to be done now."

### The current target: Node 10

Stay at v10.24.1 until ionpower-node passes a meaningful chunk of
Node 10's own behavior. Specifically:

- All `fs.*` / `fs.promises.*` APIs that ship in Node 10.
- `http`/`https`/`net`/`tls`/`dgram` parity with Node 10's API
  surface (we mostly have this).
- `util.promisify`, `util.callbackify`, `util.types`,
  `util.inspect` to Node 10's level.
- `Buffer` API parity (mostly done).
- `process.binding(...)` deprecated-but-functional stub for fs
  internals (so npm 6's `fs-minipass` and similar load).
- Whatever else the **Node test suite shows we're missing** when
  we run it against the runtime.

Closing this set lets us claim "Node 10 compatible," not just
"runs SOME node-shaped code."

### Bumping the target

When current target's Node-API gaps are down to a documented punt
list:

1. Bump `process.version` to the freshest patch in the next minor
   /major (e.g. `v10.24.1` → `v12.22.12` for the Node 12 jump,
   later `v14.21.3`, etc.).
2. Update `process.versions.node` to match.
3. Re-run smokes + selected libraries — find the new gaps.
4. Track the new target's gap closure as a new milestone in
   `docs/sessions/`.

### What we explicitly punt on

A README section listing the Node features we have decided **NOT**
to support, with the reason. Examples that already qualify:

- **Native addons** (`require('foo.node')`, N-API, NAN). Out of scope
  forever. PowerPC Tiger has no N-API ABI, no node-gyp toolchain,
  and no path that doesn't require porting V8's internals.
- **ES Modules as first-class modules.** SpiderMonkey 45's ES module
  support is incomplete. We support `import` syntax via Babel
  transpilation to CommonJS, but `import.meta.url` /
  top-level await are best-effort. Real ES modules would require
  bundling SpiderMonkey 60+, which doesn't exist for PPC.
- **Worker threads.** SpiderMonkey 45 supports them in Firefox via
  IPC pipes we don't have. Could revisit if a real consumer surfaces.
- **Performance hooks** (`perf_hooks.performance.timerify`, async
  hooks). Mostly diagnostic; rebuilding them on a non-V8 stack is a
  lot of effort for niche payoff.
- **Built-in `fetch` with native HTTP/2.** We have `fetch` (sync-curl
  shim) but not HTTP/2. Real HTTP/2 needs either nghttp2 or a JS
  implementation; deferred.

Format for each entry: **what** it is, **why** we punted, **trigger
to revisit** (i.e. what would make us pick it up).

### Documentation surface

The README needs a new section near the existing "Status" block:

```
## Node version compatibility

Currently targeting **Node 10.24.1** (last of the Node 10 line).
`process.version` reports `v10.24.1`; `process.versions['ionpower-node']`
carries the runtime's own version.

| Subsystem | Node 10 parity |
|---|---|
| fs, fs.promises | partial (see below) |
| http / https | full |
| ...

### Intentional gaps
- Native addons -- never; PowerPC Tiger has no N-API toolchain.
- ESM as first-class modules -- needs SpiderMonkey 60+; Babel
  fallback covers the syntax.
- Worker threads -- deferred until a consumer surfaces.
- ...
```

The table + intentional-gaps list give a future user (or future
session) an honest picture of what runs.

## Implementation steps

This doc captures the decision; the implementation is one runtime
commit, queued for the next session:

1. `src/node_compat/process.cpp`: change the literal in
   `DefineStringProp(... "version", ...)` from `ionpower-node-0.86`
   to `v10.24.1`. Bump and bury the runtime version under a new
   `process.versions` object keyed `node` + `ionpower-node`.
2. Smoke: `test/process_version_smoke.js` — assert
   `process.version === 'v10.24.1'`, semver-satisfies a few
   ranges, and `process.versions['ionpower-node']` is set.
3. Pair with the small fs/process additions captured in
   [`../sessions/2026-05-09-session-2-npm-6-bootstrap/notes.md`](../sessions/2026-05-09-session-2-npm-6-bootstrap/notes.md):
   `process.execPath`, `require('constants')` real seed,
   `index.json` resolver, `fs.readlink`, `process.binding` stub,
   `fs.{truncate,appendFile,chown,utimes,fchmod,symlink}`.
4. README: add the "Node version compatibility" section with the
   intentional-gaps list seeded from the items in this doc.

## Source material

The plain-language framing of `process.version` and the decision
analysis came out of a conversation captured in
[`../convos/claude-conversation-2026-05-01-6478620b.md`](../convos/claude-conversation-2026-05-01-6478620b.md)
(the npm-tooling discussion) and a follow-up conversation on
2026-05-10 where Jason asked "what is process.version?" and the
decision crystallised.
