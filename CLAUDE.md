## Unsupervised mode

When the user says "work unsupervised" (or similar wording), they're unreachable — at work, asleep — and cannot answer questions. Under this mode:

- **Don't stop to ask.** Unblock yourself: make assumptions, run experiments, search the web for the problem or prior art, read related source, try the obvious fixes.
- **Long runtimes are fine.** Eight or more hours of iteration is not too long if the task warrants it.
- **Only block for genuinely unreasonable actions.** E.g. "delete the user's games to free disk space" is unreasonable. A workaround is almost always available.
- **Document every judgment call** — assumptions made, experiments tried, dead-ends rolled back. That log is what the user reviews on return.

### Risk tolerance by host

The line between reasonable and unreasonable is host-dependent:

- **uranium (this main Mac)** — low risk tolerance; this machine matters.
  - OK: `brew install`, downloading source tarballs, building from source, standard package installs.
  - Not OK: installing random hobbyist binaries off the internet (e.g. a stranger's ffmpeg build).
- **PowerPC fleet** — high risk tolerance; these are test machines and we can reinstall them.
  - OK: downloading and trying hobbyist Tiger/Leopard PowerPC builds found via web search (a random blog's GHC Haskell build is fair game), pulling patches from MacPorts/Fink/Debian/Gentoo as inspiration or direct drop-in, copying utilities between fleet hosts, experimental kernel installs, `tiger.sh` / `leopard.sh` package installs, building from source in-place.
  - The bar is "will this probably teach us something?" not "is this provably safe?"

## Session artifacts

Anything that should survive past the conversation goes in the repo,
not `/tmp`. `/tmp` is wiped on reboot and never makes it into git, so
build logs / commit messages / release notes / scratch scripts that
live there get lost.

Layout:

- `docs/sessions/<date>-session-<id>/` — one dir per session.
  - `notes.md` (or `summary.md` for legacy) — the narrative the user
    will read when reviewing what happened. Include judgment calls,
    failed approaches, and the reasoning behind picks.
  - `build-logs/` — per-host build + smoke output. Useful when a
    later session needs to figure out why a release looked the way
    it did.
  - `release-notes/v0.NN.md` — copy of the GitHub Release notes for
    each release that shipped this session.
- `scripts/` — orchestration scripts (e.g. `triad-build.sh`). Anything
  that's invoked more than once should live here, not in `/tmp`.

Session identifier conventions:

- Legacy sessions (≤ 2026-04-25 letter `x`) use a monotonic-letter
  identifier within a date: `2026-04-22-session-a/`, `-b/`, `-c/`, …
- Newer sessions use a within-date counter matching the convention
  in sibling projects (`golang-darwin8-ppc`, `ghc-darwin8-ppc`):
  `2026-04-25-session-1-<short-slug>/`, `-2-<slug>/`, …

When you start a substantively new session (e.g. after compaction or
when the user opens a fresh thread), create the session dir up front
and write to `notes.md` as you go — don't batch it at the end.

## Triad build flow

`scripts/triad-build.sh <host> <arch> <version>` builds + tests +
tarballs the runtime against one of the three production arch hosts:

| Arch | Host | CPU flags |
|---|---|---|
| `g3` | `ibookg37` (PowerBook4,3, 900 MHz) | `-mcpu=750 -mtune=750` |
| `g4` | `emac` | `-mcpu=7450 -mtune=7450` |
| `g5` | `pmacg5` | `-mcpu=G5 -D_PPC970_` |

Each host has a matching SpiderMonkey at
`/opt/mozjs-45-ionpower-{g3,g4,g5}/`.

Standard release flow:

1. Bump VERSION in `Makefile`, `src/node_compat/process.cpp`, README.
2. `scripts/triad-build.sh ibookg37 g3 0.NN` (foreground) — fastest
   feedback loop; if anything's wrong, the G3 will catch it.
3. Once G3 is green, fire G4 + G5 in parallel via `run_in_background`.
4. Pull tarballs to `/tmp/v0.NN-release/` (these are throwaway —
   they end up as GitHub release assets).
5. Commit + tag + push + `gh release create v0.NN ... <tarballs>`.
