# Session plan: Node 10 parity, pass 6

## Read first

In order:

1. [`../039-node-10-parity-pass-5/notes.md`](../039-node-10-parity-pass-5/notes.md)
   — what pass 5 closed (TLS BIO-pair stall fix unblocking
   www.cloudflare.com + registry.npmjs.org large responses;
   demos/npm-install/).
2. [`../039-node-10-parity-pass-5/release-notes/v0.91.md`](../039-node-10-parity-pass-5/release-notes/v0.91.md)
   — what shipped, the SKIP-on-flake smoke design, what's still
   pending.
3. [`../039-node-10-parity-pass-5/build-logs/cf-tls-instrumented-v0.90.txt`](../039-node-10-parity-pass-5/build-logs/cf-tls-instrumented-v0.90.txt)
   — the diagnostic trace showing the 32 KB BIO pair stall and
   subsequent bytes-loss.

## Context in one paragraph

v0.91 closed the TLS-to-Cloudflare large-response gap that had
been the main blocker since v0.89. https.get against
www.cloudflare.com now delivers the full ~1 MB chunked body; raw
TLS to registry.npmjs.org also works end-to-end. The TLS layer is
no longer the bottleneck for registry-based `npm install
<package-name>`, but the verification didn't complete during pass
5 because Cloudflare's edge was flaky from the G3's IP during the
final hour of the session. Picking up the verification, plus the
small carryover items, is the pass-6 entry point.

## Scope

### A. Verify registry-based `npm install <pkg>` end-to-end

The strategic remaining capability for v0.91. With the TLS fix
landed, `npm install <name>` should resolve metadata from the
registry, download a tarball, extract, link, and finalize — just
like the local-tarball path that v0.90 unblocked. During pass 5,
attempts hung in npm's load() phase (likely TLS-flake driven
since network conditions were poor). When the network is calmer,
verify on G3:

    cd /Users/macuser/tmp && mkdir -p left-pad-test && cd left-pad-test
    echo '{"name":"x","version":"0.0.0"}' > package.json
    /opt/ionpower-node-0.91/bin/node \
      /Users/macuser/tmp/npm-6.14.18/bin/npm-cli.js \
      install left-pad --no-audit \
      --registry=https://registry.npmjs.org/

If this succeeds and lands `node_modules/left-pad/`, capture the
trace and add the verification to the v0.91 release notes (or
just to the pass-6 notes — v0.91 is shipped). If something
else breaks downstream of TLS, that's the next wave.

The pass-4 trace wrapper at
`/Users/macuser/tmp/run-npm-trace.js` on ibookg37 still works.

### B. Carryover items from pass 5

These were either explicitly deferred or surfaced in pass-5
exploration:

- **`process.getuid` / `getgid` / `geteuid` / `getegid`.** ~10
  lines of C++ in `src/node_compat/process.cpp`. POSIX `getuid(2)`
  etc. wired straight through. Smoke shape was prototyped (see
  pass-5 notes "process_getuid_smoke" — was written and then
  removed when scope-cut to fit pass 5's clean ship). Wire them
  in, add the smoke (assert non-negative integers), wire into
  `scripts/test-list-more.txt` after `process_extras_smoke.js`.
  Justification: tar's `preserveOwner` gate, pacote's
  `selfOwner`, npm-lifecycle's install scripts all check these.
- **`JS_ReportError → ThrowFsError`** in `src/node_compat/fs.cpp`:
  `writeFileSync`, `appendFileSync`, `copyFileSync`, `chmodSync`
  still throw bare `Error` instead of Node-shaped `FsError` with
  `.code`. Cosmetic; rare to hit but Node code that does
  `catch (e) { if (e.code === 'EACCES') ... }` will silently miss.
  Audit and convert in one wave.
- **`fs.promises.read` / `fs.promises.write`** return shape:
  Node returns `{ bytesRead, buffer }` / `{ bytesWritten, buffer }`;
  ours returns the raw integer. Not hit by npm-6.14.18 install
  path. Add when something downstream needs it.

### C. Smoke-flake debrief / better large-response endpoint

The pass-5 cloudflare smoke is shaped to SKIP on network
unreachability (exit 0 with a "SKIP" log line) so CI doesn't
block on Cloudflare's edge flakiness from the G3's IP. That's
the right escape hatch, but it does weaken the smoke's value as
a regression guard during flaky windows.

Candidates for a more reliable large-chunked-body endpoint:

- `https://raw.githubusercontent.com/<owner>/<repo>/<sha>/<bigfile>`
  — GitHub's raw blob CDN. Reliable, Content-Length set, no
  Cloudflare in front for raw blobs (though they sit behind Fastly).
- `https://www.gnu.org/licenses/gpl-3.0.txt` — small (~35 KB),
  below the stall threshold; would need a bigger doc.
- `https://registry.npmjs.org/<popular-large-package>` — depends
  on the same Cloudflare edge.
- `https://jsdelivr.net/npm/<package>/<file>` — CDN, ~1 MB JS
  bundles available.

The cleanest replacement is a `raw.githubusercontent.com` URL for
a known-large-file in a stable repo (e.g., a SpiderMonkey source
file). Pick one in pass 6, swap the smoke target, keep the
regression-shape detection (SSL_read / decryption failed) intact.

### D. (Stretch) registry-based `npm install` for a real dep

Once A works, try a package with one or two dependencies (say
`is-arrayish` or `chalk@2` — small, popular, dep-light). That
exercises the metadata-resolve loop that wasn't tested by the
single-tarball case.

## Working order

1. Read the three "Read first" docs.
2. **A.** Wait for / verify network conditions are healthy
   (manual smoke run from G3 should pass without SKIP). Then
   try `npm install left-pad`. Capture trace.
3. If A surfaces a new wall (some downstream gap), that becomes
   the next wave; if it works, log it and move on.
4. **B.** Process.getuid+gid wave is trivial (~30 min); do it
   even if A is stuck on something deeper, since it's
   pre-positioning for future npm-lifecycle work.
5. **C.** Swap the smoke target to a more reliable endpoint.
6. Triad-build whatever combination of waves shipped. v0.92 or
   v0.92-rc depending on what landed.

## Risk / blast radius

A: Pure verification — no code change unless a downstream wall
appears.

B (getuid): trivial additive C++; same shape as
`process.cwd` etc. Smoke is local-only. Risk near zero.

C (smoke endpoint swap): test-only change. Risk near zero, but
choose the new endpoint carefully — it has to (1) reliably return
a large chunked-or-content-length response, (2) be unlikely to
disappear, (3) ideally not be rate-limited from our IPs. Validate
manually on G3 + G4 + G5 before committing the swap.

## Current runtime state (start of this session)

- v0.91 shipped:
  <https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.91>
- ibookg37 / emac / pmacg5 each have `/opt/ionpower-node-0.91/bin/node`
  installed and 470/470 PASS (tests).
- ibookg37's `/Users/macuser/tmp/npm-test/node_modules/mri/` is
  still the local-tarball-install fixture from pass 4.
- Tarballs at `/tmp/v0.91-release/` locally; also as v0.91 GitHub
  release assets.
- VERSION in repo is `0.91`. Bump to `0.92` as the first pass-6
  edit (or leave at `0.91` if not cutting a release).

## Quick references

- pass-5 notes:
  [`../039-node-10-parity-pass-5/notes.md`](../039-node-10-parity-pass-5/notes.md)
- pass-5 release notes:
  [`../039-node-10-parity-pass-5/release-notes/v0.91.md`](../039-node-10-parity-pass-5/release-notes/v0.91.md)
- The TLS fix (for review):
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  search `_TLSSocket.prototype._onRawData`.
- The cloudflare smoke:
  [`test/tls_cloudflare_smoke.js`](../../../test/tls_cloudflare_smoke.js)
- npm trace wrapper on ibookg37:
  `/Users/macuser/tmp/run-npm-trace.js`
- Local mri tarball still cached on ibookg37:
  `/Users/macuser/tmp/mri-1.2.0.tgz`
