# Session handoff: Node 10 parity, pass 15

## Session was cut short

Jason shut down pass 14 early — **before any triad build completed**.
Local source changes for v1.0 are staged but uncommitted; no
tarballs were produced; no tag was pushed. The wave-2 survey
(item B from the pass-14 handoff) is complete and its results
are saved locally.

## Read first

1. [`notes.md`](notes.md) — pass-14 narrative. Covers the survey
   wave 2, the four runtime bugs surfaced + fixed (proto-warning
   filter, subpath `.json` resolution, SM45 lazy-parse trap, http2
   throwing stub), and the v1.0 scope decision.
2. [`release-notes/v1.0.md`](release-notes/v1.0.md) — draft
   release notes. **Untested.** Numbers and claims need to be
   re-verified once the triad build actually runs to completion.
3. [`build-logs/summary.tsv`](build-logs/summary.tsv) +
   [`build-logs/survey-wave-2-logs/`](build-logs/survey-wave-2-logs/) —
   the raw wave-2 data. 32 packages; 23 OK, 9 fail (9 = 7
   REQUIRE_FAIL + 2 INSTALL_FAIL).
4. [`build-logs/g3-build.log`](build-logs/g3-build.log) — the
   incomplete G3 build. **Link succeeded; test-all started but
   no smoke output was captured before the local task was killed.**

## State at session end

### Source changes — uncommitted, in working tree

```
 M Makefile                     (VERSION 0.99 -> 1.0)
 M README.md                    (0.99 strings -> 1.0)
 M scripts/test-list-core.txt   (+4 new smokes)
 M src/main.cpp                 (proto-warning filter + setDisableLazyParsing)
 M src/node_compat/globals.cpp  (http2 stub + builtinModules expansion)
 M src/node_compat/process.cpp  (versions["ionpower-node"] 0.99 -> 1.0)
 M src/node_compat/require.cpp  (subpath .json probe)
?? docs/sessions/048-node-10-parity-pass-14/
?? test/babel_lazy_parse_fallback_smoke.js
?? test/http2_stub_smoke.js
?? test/proto_warning_filter_smoke.js
?? test/require_subpath_json_smoke.js
```

Run `git status` from `/Users/cell/claude/ionpower-node/` to
re-verify. Nothing is staged; nothing is committed.

### G3 build state

`scripts/triad-build.sh g3 1.0` got as far as:

1. ✅ scp source to ibookg37
2. ✅ clean + build (linker warnings only — same noise as v0.99)
3. ⏸ **test-all phase started, then we killed the local task.**
   No smoke output reached the log.

The `node` binary on G3 at `/Users/macuser/tmp/ionpower-node/node`
**is the new v1.0 binary** — the build linked. It just hasn't been
exercised by the smoke suite yet, so I can't claim "tests pass."

G4 and G5 builds were **not started**.

### Wave-2 survey — complete, results saved

23 OK / 7 REQUIRE_FAIL / 2 INSTALL_FAIL of 32. Categorized in
[`notes.md`](notes.md) — six categories, three of which became
runtime fixes in v1.0 (`.json` subpath, lazy-parse, http2 stub),
one cosmetic fix (proto-warning), and four out-of-scope (BigInt,
yargs engine check, peer-dep absence, npm flakes).

The two BIG wins from wave-2 that weren't on the pass-14 handoff
radar:

- **SM45 lazy-parse trap** (luxon). The require wrapper
  `(function (exports, ...) { body })` was compiling clean and
  deferring the body parse to call time, past our Babel
  parse-failure fallback. `setDisableLazyParsing(true)` on the
  compartment fixes it. This very likely explains the transient
  yup failure during the sweep too — yup uses async method
  shorthand which Babel handles, but only if the parse error
  fires at compile time so the fallback can catch it.
- **Subpath JSON resolution** (meow → spdx-license-ids/deprecated).
  Tiny resolver fix.

## Punch list — pass 15

### A. Resume the triad build (the must-do)

```sh
# From /Users/cell/claude/ionpower-node/
scripts/triad-build.sh g3 1.0   # foreground — fastest feedback
# then in parallel once G3 is green:
scripts/triad-build.sh g4 1.0 &
scripts/triad-build.sh g5 1.0 &
```

`scripts/check-test-coverage.sh` already passed locally (502
files accounted for, all 4 new smokes wired). The new smokes:

- `test/proto_warning_filter_smoke.js` (spawns a child to check
  stderr)
- `test/require_subpath_json_smoke.js` (synthetic pkg with
  `deprecated.json` at root)
- `test/babel_lazy_parse_fallback_smoke.js` (the luxon trigger)
- `test/http2_stub_smoke.js` (load, throw, constants,
  builtinModules)

**Risk to watch:** `setDisableLazyParsing(true)` is a global
behavior change. Every function body in every module now parses
eagerly. This will slow startup by a small constant amount and
might surface latent parse bugs in *cached* Babel output that
previously got away with being half-broken because the bad
paths never executed. If any libs-smoke regresses, that's the
likely place to look first.

### B. Retry the two npm flakes

`got@11` and `inquirer@8` install-failed during wave 2 with classic
npm-6 flakes (`cb() never called!`, `read errno 54`). Both are
HTTP-client / TUI packages worth confirming on a fresh binary:

```sh
ssh ibookg37 'cd /Users/macuser/tmp/survey-048 && ./survey-one.sh got@11; ./survey-one.sh inquirer@8'
```

If got@11 succeeds on retry, it'll go through the new http2 stub
path — extra signal that the stub is doing what we want. inquirer
is a pure TUI library; it should just work.

### C. Spot-check the actual fix candidates

Pass-13's express@5 end-to-end re-run is the regression baseline.
Beyond that, this pass should specifically re-test:

- **luxon** (the lazy-parse trigger): should `require('luxon')`
  cleanly now. Cache-wipe to confirm Babel actually runs on it.
  `ssh ibookg37 'rm -rf ~/.ionpower-cache/babel-v1/_*luxon* &&
    cd /Users/macuser/tmp/survey-048/pkgs/luxon && /Users/macuser/tmp/ionpower-node/node ./lxt.js'`
  (the `lxt.js` smoke I wrote during pass 14 is still there).
- **meow** (the subpath-JSON trigger): same form.
- **axios@1.x** (the http2 stub trigger): not in the wave-2
  list but trivially testable from `/Users/macuser/tmp/survey-047/pkgs/axios/`.

### D. Cut v1.0

Once the triad is green:

```sh
git add -A
git commit -m "v1.0: ..."          # see release-notes/v1.0.md for content
git tag v1.0
git push origin main --tags
gh release create v1.0 \
    --title "v1.0: ..." \
    --notes-file docs/sessions/048-node-10-parity-pass-14/release-notes/v1.0.md \
    /tmp/v1.0-release/ionpower-node-1.0-g3-ppc.tar.gz \
    /tmp/v1.0-release/ionpower-node-1.0-g4-ppc.tar.gz \
    /tmp/v1.0-release/ionpower-node-1.0-g5-ppc.tar.gz
```

The release notes draft already reads as if v1.0 shipped — proof
the build was green and the new smokes passed. **Update the
Verification section once you have real numbers** (the draft says
"All 25 core smokes pass" and "All 495 / 0 libs smokes pass" —
those are assertions, not facts; the test-all phase didn't
complete locally).

### E. Pass-14 carryover items still relevant

From the pass-14 handoff (item C / D), now mostly handled:

- ✅ http2 stub — done (item A from pass 14)
- ✅ proto-warning filter — done (item C from pass 14)
- Survey wave 2 — done
- ❌ BigInt — deferred to a future pass. Document in v1.0 notes
  (already in the draft).
- ❌ yargs@17 engine check — userland; can't fix from runtime.

## Working order

1. **Resume the triad build first** — the source changes are
   sitting on disk; until they compile + pass tests on all three
   hosts, the v1.0 narrative isn't real.
2. **Retry flakes + spot-check fix candidates** as a sanity pass
   before the release.
3. **Commit + tag + push + release.** The release-notes draft is
   ready; tweak the Verification section to match real test
   numbers.
4. **Next-next pass** (v1.0+): wave-3 survey (another 30-50
   packages) is the natural follow-on; BigInt is the only known
   real-gap blocker left.

## Notes / scratch

- `/Users/macuser/tmp/survey-048/` on G3 still has all 32
  wave-2 packages installed — saves the install cost if you
  want to re-test any specific one.
- Babel disk cache at `~/.ionpower-cache/babel-v1/` on G3 is
  warm (~900+ entries after wave 2). **Don't wipe.** A cache-warm
  full-libs sweep is ~20 min; cold is ~45 min plus.
- The `survey-one.sh` BASE path on G3 was patched to
  `survey-048` in-place; the file under
  `docs/sessions/047-.../survey-one.sh` still has `survey-047`
  hardcoded. If you scp again, re-patch.
- ibookg37 was stable for the entire pass-14 session — no
  banner-hang reboots. HDD still on borrowed time; mSATA swap
  still on the todo.

## Path to this file (per memory convention)

```
/Users/cell/claude/ionpower-node/docs/sessions/048-node-10-parity-pass-14/handoff-pass-15.md
```
