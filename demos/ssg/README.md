# ssg — a tiny static site generator demo

Proves the pieces compose: `marked` + `handlebars` + `fs` + `path`
together, all driven by `ionpower-node`, all synchronous, all on
PowerPC Tiger.

## Run

```bash
cd demos/ssg
../../node build.js
```

Reads every `*.md` in `input/`, renders through marked, wraps in
`template.hbs`, writes to `output/<name>.html`.

Expected output is a handful of complete HTML pages with a shared
layout. The `hello.md` page includes code fences, blockquotes, lists,
and emphasis — so if all the marked features round-trip through the
template cleanly, the demo is working.

## What it's proving

Smoke tests like `test/marked_smoke.js` and `test/handlebars_smoke.js`
verify each library in isolation. This demo is the composition test:

1. **Real fs I/O chain**: `readdirSync(input/)` → `readFileSync(each)`
   → `writeFileSync(output/each)`. Exercises the sync-only filesystem
   promise in the shape a real build tool would use it.
2. **Cross-module data flow**: marked's output (HTML string) becomes
   handlebars's `{{{body}}}` input; no escaping mishaps.
3. **path composition**: `path.join(root, "input")` plus
   `path.dirname(process.argv[1])` — the natural shape of every
   "locate-files-relative-to-me" pattern.
4. **Nontrivial `require` resolution**: the demo lives in
   `demos/ssg/`, the vendored libs in `../../test/vendor/`. Our
   CommonJS `require` has to walk `..` correctly.

## Timings (imacg52, G5 2.0 GHz)

On first run, unmeasured — roughly "under a second for three short
pages," which includes spinning up the runtime, JIT-compiling marked
and handlebars on load, and rendering. On subsequent invocations a
warmed-up SpiderMonkey would be faster, but we don't run daemon-
style yet.
