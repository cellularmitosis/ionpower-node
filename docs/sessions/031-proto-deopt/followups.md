# Follow-ups from the v0.85 ship night

Two small items captured here so they don't get lost. Pick up
*immediately* after the Tiger-Safari demo work that's currently in
flight.

## 1. `scripts/check-demo-deps.sh`

Static dep-walk for the demos, modeled on `check-test-coverage.sh`.

**Why.** Tonight we shipped v0.85 G3 three times in a row because the
`make install` rule kept missing transitive `test/vendor/` deps that
the demos pull in:

  - `codes.json` — `statuses.js` does `require('./codes.json')`,
    used by `express → http-errors → statuses`.
  - `ee-first.js` — `on-finished.js` does `require('./ee-first.js')`,
    used by `express → finalhandler → on-finished`.
  - Six other relative `./xxx.js` deps from shipped standalone
    vendor files (`parse-ms`, `is-plain-obj`, `emoji-regex`,
    `is-fullwidth-code-point`, `ansi-regex`, `sax`).

Each was a "demo crashes after install but not in dev tree" surprise.
A static walk over `demos/**/*.js` requires + the closure of relative
requires inside the shipped subset would have caught all eight gaps
instantly.

**What it should do.**

1. Add a `print-demo-deps` Makefile target that emits the four
   `DEMO_VENDOR_*` lists. Keeps the Makefile as the source of truth
   instead of re-parsing it from bash.
2. Walk every `demos/**/*.js` for `require('…test/vendor/…')` and
   recursively follow relative `require('./x.{js,json}')` within
   shipped files until closure stabilises.
3. Compare closure against `DEMO_VENDOR_FILES` ∪ `DEMO_VENDOR_JSON`
   ∪ recursive contents of `DEMO_VENDOR_DIRS` ∪ `nm/node_modules/<x>/`
   for each `DEMO_VENDOR_NM_DIRS`.
4. Print missing entries with the demo that introduced them. Exit 1
   if there are any.
5. Wire into `scripts/triad-build.sh` next to the existing
   `check-test-coverage.sh` call, and add a `make check-demo-deps`
   target.

**What it doesn't catch.** Bare-name requires (`require('on-finished')`
from inside a vendored lib) that fall through to a Node-style
node_modules lookup we don't ship. We don't have that pattern today;
worth a comment in the script explaining the boundary so future-us
doesn't assume coverage we don't have.

## 2. One-liner in `globals.cpp` to surface error messages

The io-watcher's catch-all wrapper currently does:

    try { cb(); }
    catch (e) { console.error('io-watcher:', e && e.stack || e); }

SM45's `Error.stack` does **not** include the message — only frames.
So when express-chat threw `TypeError: finalhandler is not a function`
tonight, all we saw was a stack of frames, message gone. Tonight's
debug took ~30 minutes of monkey-patching `app.handle` with a wrapper
just to surface "the actual error was …". Should have been a
10-second look at the log.

Fix: `e.name + ': ' + e.message + '\n' + e.stack`. Same for the
`child-exit:` wrapper a few lines down. `src/node_compat/globals.cpp`
~line 5095. Trivial.

Pair it with the `child-exit:` wrapper and any other
`console.error('XYZ:', e && e.stack)` patterns elsewhere in the
bootstrap text — there may be a few. Quick `grep` will turn them up.

Worth doing whenever we next rebuild the runtime for v0.86 — would
have made tonight's debug a 10-second job.
