# Session handoff: Node 10 parity, pass 16

## Pass 15 shipped v1.0

[`release-notes/v1.0.md`](release-notes/v1.0.md) is the as-shipped
release. Five fixes — three from pass 14 (subpath `.json` resolution,
lazy-parse disable, proto-warning filter), one from the pass-14 radar
(http2 throwing stub), and one found during pass-15 verification
(`require.cache` propagation). Triad clean on all three hosts:
26 core / 495 libs / 0 fail per host.

## Read first

1. [`notes.md`](notes.md) — pass-15 narrative. The interesting
   subplot is the require.cache discovery: pass-14's subpath-JSON
   fix unblocked meow's resolver, which then exposed a second
   dependency-of-meow gap (`delete require.cache[__filename]`) that
   only manifested *after* the resolver fix. Two-layer require shim
   teach-moment is worth a read.
2. [`release-notes/v1.0.md`](release-notes/v1.0.md) — as-shipped
   release notes (this version, not the pass-14 draft).
3. [`build-logs/`](build-logs/) — three good triad logs (attempt 3),
   the two failed attempts (attempt 1 missed the require.cache gap;
   attempt 2 had the fix in require.cpp but not globals.cpp), plus
   per-host test-all transcripts.
4. The pass-14 draft v1.0 release notes are still in
   [`../048-.../release-notes/v1.0.md`](../048-node-10-parity-pass-14/release-notes/v1.0.md)
   for diff'ing if you want to see what slid in during pass 15.

## State at session end

- Two commits on `main`:
  - `v1.0: 5 fixes — …` (source + 5 new smokes).
  - `docs/sessions/048+049: …` (both session dirs + release notes
    + handoffs).
- Tag `v1.0` on the second commit.
- GitHub release `v1.0` with the three tarballs from
  `/tmp/v1.0-release/`:
  - `ionpower-node-1.0-g3-ppc.tar.gz`
  - `ionpower-node-1.0-g4-ppc.tar.gz`
  - `ionpower-node-1.0-g5-ppc.tar.gz`
- All three production hosts (ibookg37, emac, pmacg5) have their
  v1.0 binaries installed at `/opt/ionpower-node-1.0/` and the
  source trees at `/Users/macuser/tmp/ionpower-node/` are at v1.0
  state.
- `/Users/macuser/tmp/survey-048/` on G3 still has all 32 wave-2
  packages installed, plus updated `summary.tsv` lines for the
  flake-retry pass (`got` REQUIRE_FAIL regex gap, `inquirer` OK).
- Babel disk cache at `~/.ionpower-cache/babel-v1/` on G3 is warm
  for ALL of the v0.99 + pass-14 + pass-15 packages plus the new
  v1.0 binary's transpiles. Roughly ~1000+ entries. **DO NOT WIPE**
  — a cache-warm full-libs sweep is ~20 min; cold is ~45 min+.

## Punch list — pass 16

### A. Wave-3 survey (the natural follow-on)

Same pattern as wave 2: another 30–50 popular Node-10-era packages
through `survey-one.sh` on G3 against the v1.0 binary. The pass-14
candidate list focused on HTTP / util / async / build-CLI / data
/ templating / dates / streams. Wave 3 could lean into:

- **CLI / TUI**: `commander@10`, `cosmiconfig`, `update-notifier`,
  `boxen`, `chalk@5` (ESM-only, will test our import path),
  `figlet`, `cli-table3`, `enquirer`
- **Database / ORM (read-side)**: `knex` query builder bits,
  `mysql2`, `pg` (require-load only — no live conn), `redis@4`,
  `ioredis` (require-load only)
- **Streams / parsing**: `csv-parse`, `csv-stringify`, `xml2js`,
  `fast-xml-parser`, `papaparse`, `cheerio` (HTML parser)
- **Crypto / hash**: `bcrypt` (native — won't load on PPC, but
  it'd be useful signal), `bcryptjs` (pure JS), `jose`, `jsonwebtoken`
- **File / archive**: `archiver`, `tar`, `extract-zip`, `unzipper`,
  `tar-stream`

The signal we want: how many of these are pure ES5-ish today, how
many hit `BigInt`/`(?<name>…)`/`async iterator` walls, how many need
a require shim we don't yet have. Group by category. If a category
of failure has a fix worth more than ~30 lines, that's pass-17 fuel.

### B. ES2018 regex polyfill scoping

`got@11` failed because `normalize-url` uses named capture and
lookbehind. If wave 3 surfaces a second package with the same
pattern, it's worth costing out a polyfill approach:

- **Per-package patch via Babel cache rewrite**: when Babel parses
  a file and sees a regex literal containing `(?<` or `(?<!`,
  rewrite the regex at transpile time to use numbered captures and
  manual lookbehind via a wrapper function. Risky — regex semantics
  are subtle.
- **Build-time codemod**: ship a script that visits popular
  problematic packages in `node_modules/` and patches them. Fragile
  but very narrow.
- **Document and move on**: same as BigInt — wait for the
  ecosystem to settle on the long-term answer or for SM upgrade
  feasibility (would need a TenFourFox-class effort).

My take: defer until two more packages hit it, then choose. Right
now it's one package.

### C. BigInt polyfill — costing-out study

Pass 14 deferred BigInt as "non-trivial." Worth a focused day:
read the SM52+ patch that introduced BigInt to spot how big the
delta is at the JIT layer. If it's < 5k lines of mostly-isolated
type integration, maybe we can backport. If it's deeply intertwined
with the IonMonkey JIT (it usually is — BigInt is a runtime
primitive), then this becomes a 1-2 month side project (a la
TenFourFox's own backporting work) rather than a parity-pass item.

Either way, document the cost in `docs/sessions/`. The decision
matters for whether `superagent` / `make-fetch-happen` / cuid2
/ ip-address are addressable at all.

### D. Two-layer require shim audit

From pass-15 notes — anything added to `__make_require__` in
[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
is invisible unless the rewrap in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
(around line 10470) explicitly forwards it. Today the rewrap
forwards `resolve` + `cache`. Missing (Node has them):

- `require.main` — refers to the entry-point Module object. Used
  by `if (require.main === module) { ... }` (the canonical
  "is this script being run directly" check). meow's
  `module.parent.filename` chain might also need `module.parent`
  set up correctly.
- `require.extensions` — deprecated but some old packages still
  read it.
- `require.resolve.paths` — paths array; rarely used.

None of these have surfaced as blockers yet. Worth adding as
shims preemptively + a smoke that exercises each, so the
two-layer trap doesn't bite again.

### E. ibookg37 mSATA swap — still on the todo

HDD on the iBook G3 is still on borrowed time. No banner-hang
reboots during pass 15, but the last pass-14 handoff flagged it.
If you happen to be ordering parts, a 256 GB mSATA + IDE adapter
is the next pre-emptive maintenance.

## Working order

1. **Read pass-15 notes** for the require.cache subplot.
2. **Wave-3 survey** — the highest signal-per-hour task.
3. **Decide on BigInt and/or ES2018 regex deep-dive** based on
   wave-3 results. Don't commit to either until you have wave-3
   data in hand.
4. **Two-layer require shim audit** — defensive, cheap (~30 min
   of code + smokes).

## Notes / scratch

- `/tmp/v1.0-release/` on uranium still has the tarballs (in case
  the GitHub release needs an asset re-upload).
- Build-log retention: pass 15 keeps both attempts' logs deliberately
  (`-attempt1.log`, `-attempt2-failed.log`) so the require.cache
  discovery story is auditable from disk alone.

## Path to this file (per memory convention)

```
/Users/cell/claude/ionpower-node/docs/sessions/049-node-10-parity-pass-15/handoff-pass-16.md
```
