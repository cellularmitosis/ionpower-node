# Session 053 — Node 10 parity, pass 18

Picked up from
[`051-node-10-parity-pass-17/handoff-pass-18.md`](../051-node-10-parity-pass-17/handoff-pass-18.md).
Pass-17 shipped v1.1 with the MODULE_NOT_FOUND error code, the
Module-API shim audit, and six lumo-asks landing natively. Wave-3
ended at 57 % OK (16 / 28) with three small-fix candidates flagged
for pass 18 (handoff §A — pg, redis, figlet).

This pass works the three "small-fix" candidates and ships v1.2.

## Numbering note

Pass-17's handoff suggested "pass-18 should use 052". Between then
and now, `052-handoff-from-lumo/` landed (lumo round-3 handoff).
Sessions are arrival-ordered, so this dir is **053**.

## A1 — `Buffer.prototype.write(string[, offset[, length]][, encoding])`

**Symptom (pass-16).** `pg-protocol`'s
`buffer-writer.js:44` calls `this.buffer.write(string, offset)`
and we threw `this.buffer.write is not a function`.

**Diagnosis.** `src/node_compat/buffer.cpp`'s kPatch installs
`writeUInt8 / writeUInt16LE / writeUInt32BE / ...` on
`Uint8Array.prototype` but not `write(string, ...)`.

**Fix.** JS-side method on `Uint8Array.prototype`. Argument
shuffling matches Node's signature:

- `buf.write(string)` → at offset 0, full length, utf8
- `buf.write(string, encoding)` → at 0, full length, given encoding
- `buf.write(string, offset)` → offset given, rest of buf, utf8
- `buf.write(string, offset, encoding)` → encoding as 3rd if string
- `buf.write(string, offset, length, encoding)` → all four

Implementation uses `Buffer.from(string, encoding)` then bytecopy.

## A2 — `require('.')` and `require('..')` resolver

**Symptom (pass-16).** redis@4's
`@redis/client/dist/lib/cluster/multi-command.js:36` does
`require('.')` to mean "this directory's `index.js`". We threw
`cannot find module '.'`.

**Diagnosis.** `src/node_compat/require.cpp`'s `ResolveModule`
gates relative resolution on:

    spec[0] == '.' && (spec[1] == '/' ||
                       (spec[1] == '.' && spec[2] == '/'))

That doesn't match bare `.` or bare `..`, both of which fall
through to the bare-specifier `node_modules` walk and miss.

**Fix.** Extend the gate so bare `.` and `..` are treated as
relative to `from_dir`. The downstream `TryModuleExtensions` /
`CanonicalizePath` correctly resolves `<from_dir>/.` to a
directory and tries `package.json` `main` / `index.js` etc.

## A3 — figlet's `_interopNamespaceDefault` returns wrong members (revised diagnosis)

**Symptom (pass-16).** `figlet`'s `node-figlet.cjs:26` threw
`path__namespace.dirname is not a function`. The Babel-bundled
file builds a `path__namespace` via:

    for (const k in e) {
      const d = Object.getOwnPropertyDescriptor(e, k);
      Object.defineProperty(n, k, d.get ? d : {
        enumerable: true, get: () => e[k]   // arrow captures k
      });
    }

**Pass-16's hypothesis:** path's methods aren't enumerable, so the
for-in loop sees nothing.

**Verified on the actual v1.1 binary on ibookg37, and that
hypothesis is wrong.** `require('path')` is built as a JS object
literal in `src/node_compat/globals.cpp:564` (`var path = { join:
__path_native__.join, ... }`), and JS object literals install
properties enumerable by default. `Object.keys(require('path'))`
returns all 15 keys on v1.1.

**Actual diagnosis.** SM45 doesn't per-iteration-bind `let`/`const`
in *any* loop form. Confirmed against v1.1:

    for (const k in obj) arr.push(() => k);    // [c,c,c]  (should be [a,b,c])
    for (let v of [1,2,3]) arr.push(() => v);  // [3,3,3]
    for (let i=0; i<3; i++) arr.push(() => i); // [3,3,3]

This is a fundamental ES2015 conformance gap in mozjs-45. Closures
inside `let`/`const` loops capture the post-loop value instead of
the per-iteration value. Figlet's `_interopNamespaceDefault`
trips it: every `path__namespace.<key>` getter returns
`path[lastKey]` — which is `path.win32` (an object), so
`.dirname` on it returns the `path.dirname` function bound via
the win32 namespace, looking like `undefined.dirname` errors or
"not a function" errors depending on the access path.

**Fix.** Already provable: babel's preset-env at `targets: { ie:
'11' }` lowers block-scoping correctly (verified by force-routing
the failing snippet through the existing parse-error babel
fallback — the lowered code produced `[a, b, c]`).

The change is therefore to **trigger babel pre-emptively** when
the source contains `for (let|const ...)` — not only on parse
failure. Implementation: cheap C-side substring scan in
`require.cpp` before `wrapAndEval`; if matched (and not opted
out via `IONPOWER_NO_BABEL=1`), call the existing
`__try_babel_transpile__` hook proactively and evaluate the
lowered code. Disk cache at `~/.ionpower-cache/babel-v1/`
amortizes the cost across runs.

This is a wider net than just figlet: any package using
`for (let)` / `for (const)` with closures inside hits the same
bug. We bear the babel cold-cache cost for those files
unconditionally — but that's strictly more correct.

## Plan + ordering

1. Land A1, A2, A3 in source. Smokes for each.
2. Triad build (G3 foreground; then G4 + G5 parallel).
3. Wave-3 retry on G3 against the new binary: pg + redis +
   figlet expected to pass. Maybe more.
4. If green, bump VERSION → 1.2, tag, push, GH release.

## Round-2 fix — `Buffer.prototype.writeInt32BE`

First-round build hit a follow-on against the wave-3 retry:

    === pg ===
    REQUIRE_FAIL this.buffer.writeInt32BE is not a function
       at join@.../pg-protocol/dist/buffer-writer.js:68
       at flush@.../pg-protocol/dist/buffer-writer.js:73

A1's `Buffer.prototype.write(string, ...)` fix worked — pg-protocol
no longer trips on the string-write call. But it ALSO uses
`writeInt32BE` (to emit the message-body length header), and our
kPatch shipped only `writeUInt32BE` / `writeUInt32LE`.

Two's complement on the wire is identical to the unsigned form for
the same width (JS bitwise ops mask via int32 coercion), so the
signed variants are one-line aliases of the unsigned. Added in the
same kPatch:

- `writeInt8`
- `writeInt16LE` / `writeInt16BE`
- `writeInt32LE` / `writeInt32BE`

`buffer_write_smoke.js` extended with positive + negative coverage
for each new method (notably `writeInt32BE(-1, 0)` → `[0xff, 0xff,
0xff, 0xff]`).

Round-2 retry on the fresh binary verified: **redis OK, figlet OK,
pg OK**. All three wave-3 unblockers cleared, matching the pass-17
handoff's prediction.

## Extended wave-3 retry

Re-ran the other v1.1 REQUIRE_FAILs against the v1.2 G3 binary to
see if anything else opened up:

| Package | v1.1 | v1.2 | Notes |
|---|---|---|---|
| `pg` | REQUIRE_FAIL | **OK** | A1 + writeInt32BE |
| `redis@4` | REQUIRE_FAIL | **OK** | A2 |
| `figlet` | REQUIRE_FAIL | **OK** | A3 |
| `update-notifier` | REQUIRE_FAIL | unchanged | `util.promisify(undefined)` in stubborn-fs — ecosystem bug, not ours |
| `boxen` | REQUIRE_FAIL | unchanged | `Intl is not defined` in string-width — engine gap |
| `chalk@5` | REQUIRE_FAIL | unchanged | `#ansi-styles` imports map — package.json imports field, gap |
| `jose` | REQUIRE_FAIL | unchanged | `import` declaration in a CJS dist file — ESM/CJS confusion |
| `archiver` | REQUIRE_FAIL (`async functions are not enabled`) | **progress**, then transitive dep missing — `Cannot find module 'compress-commons'` | Babel pre-empt cleared the parse error; npm hadn't pulled `compress-commons` into the install tree. Real fix needs a re-install of the package's deps; defer. |
| `tar` | REQUIRE_FAIL (`missing : after property id`) | unchanged | tar's syntax isn't lowered by preset-env. Defer (tar@6 works). |

Net wave-3 OK rate: **16/28 (57 %) → 19/28 (68 %)**, matching the
pass-17 prediction.

Archiver is the interesting story — the pre-empt babel fix cleared
the async-functions parse error that pass-16 categorized as "babel
parse-fallback didn't kick in." So the pre-empt path closes the
same gap that the parse-error fallback would have, for files
whose `for(let|const)` triggers the heuristic. Pass-19 could
investigate: is the heuristic too narrow? Should we trigger babel
on any source that contains `async function` or `await`?

## Release

v1.2 tagged + pushed; GH release at
[`v1.2`](https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.2)
with G3/G4/G5 tarballs attached. Install path
`/opt/ionpower-node-1.2/` populated on all three triad hosts.
Tarballs also live at `/tmp/v1.2-release/` on uranium (throwaway —
they're attached to the release).

### Per-host verification

| Host | Arch | Cold-build | test-all | Final | Notes |
|---|---|---|---|---|---|
| ibookg37 | G3 (PPC 750, 900 MHz) | OK | 34 + 495 | **529 / 0** | round-1 + round-2 both passed; round-2 hit no flakes |
| emac | G4 (PPC 7450) | OK | 34 + 495 | **529 / 0** | round-2 hit fs_watch flake; retry passed |
| pmacg5 | G5 (PPC 970) | OK | 34 + 495 | **529 / 0** | round-2 hit fs_watch flake; retry passed |

### Round-1 wave-3 retry artefacts

`build-logs/g3-round1.log` — first G3 build log (succeeded; smokes
passed; install + tarball done; wave-3 retry found pg's
writeInt32BE gap).
`build-logs/g4-aborted.log`, `g5-aborted.log` — G4 + G5 round-1
builds, killed mid-test-all so they wouldn't ship without the
writeInt32BE fix. Resumed in round 2 below.

### Round-2 build

`build-logs/g3.log`, `g4.log`, `g5.log` — final round-2 logs
(round-1 artefacts kept for the record).
