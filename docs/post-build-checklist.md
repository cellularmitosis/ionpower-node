# Post-build checklist

What to do once `/Users/macuser/tmp/build-mozjs-resume2.log` shows
`[build done 0]` (i.e. watcher task `b9epfirhb` fires with
`[SUCCESS]` in its output).

## 1. Verify the SpiderMonkey install layout

```bash
ssh imacg52 'ls -la /opt/mozjs-45-ionpower/{lib,bin,include}'
```

Expected shape:

- `lib/libmozjs-45.a` (static; `--disable-shared-js` was passed)
- `lib/libmozjs-45.pc` (pkg-config)
- `lib/libjs_static.ajs` (desc file)
- `bin/js` (standalone SpiderMonkey shell)
- `bin/js-config` (configure-time settings)
- `include/mozjs-45/jsapi.h` + many more headers

If `libmozjs-45.a` is missing but `libjs_static.a` is present in
`$OBJDIR/js/src/`, follow `docs/fallback-plans.md` §2 — copy and
rename manually.

## 2. Verify the JIT is alive

```bash
ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --help 2>&1 | grep -iE "ion|baseline" | head'
```

Should list `--ion`, `--no-ion`, `--baseline`, `--no-baseline`, plus
the long roster of `--ion-*` optimization toggles. If these are
absent, the JIT was compiled out somewhere — see
`docs/fallback-plans.md` §"If the JIT never appears to run".

## 3. Run the JIT benchmark via the stock shell

Before worrying about the Node-compat bridge at all, confirm the
JIT actually runs code faster on imacg52:

```bash
ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --ion-eager \
    /Users/macuser/tmp/ionpower-node/test/verify_jit.js'
ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --no-ion --no-baseline \
    /Users/macuser/tmp/ionpower-node/test/verify_jit.js'
```

Expect the `--ion-eager` run to be dramatically faster (5-10× on
a tight integer loop is typical for IonPower vs interpreter on a
G5). If times are indistinguishable, the JIT was built but isn't
being selected.

## 3b. Link-smoke the install

Before building the whole bridge, verify the mozjs library is
link-usable by compiling a 12-line standalone program:

```bash
scp scripts/link-smoke-test.sh imacg52:/Users/macuser/tmp/
ssh imacg52 '/Users/macuser/tmp/link-smoke-test.sh'
```

Expected output: `ok: runtime created`. If linking fails here, the
bridge won't link either — triage via `docs/fallback-plans.md`
before touching the Makefile.

## 4. Build the bridge

```bash
./scripts/deploy-and-test.sh
```

This rsyncs sources to `imacg52:/Users/macuser/tmp/ionpower-node/`,
builds with the Makefile, and runs the full smoke suite.

Expected first-time stumbles (address each as it comes):

- **Missing `-l<foo>` at link.** The Makefile has `-lmozjs-45
  -lpthread -lm -lz`. If `ld` reports missing NSPR symbols
  (`_PR_*`), follow `docs/fallback-plans.md` §"If linking the
  bridge fails with undefined NSPR symbols".
- **`undefined symbol: __stack_chk_*`.** Means gcc 4.9 emitted
  stack-protector calls that libjs_static didn't. Add
  `-fno-stack-protector` to the Makefile's CXXFLAGS.
- **`duplicate symbol _main`** or similar. Means my `main` in
  `src/main.cpp` conflicts with a shell `main`. Shouldn't happen
  because we don't link shell code, but easy to verify with
  `nm libmozjs-45.a | grep ' T _main'`.
- **Runtime crash on first `JS_NewPlainObject`.** Usually a GC
  root got missed in the bridge. Rerun under `gdb`.

## 5. Run the smoke tests

In deploy-and-test.sh order:

1. `./ionpower-node test/hello.js` — baseline. Prints greeting,
   argv, platform/arch/pid.
2. `./ionpower-node test/require_chain.js` — exercises require
   resolution (./mod/adder/index.js, ./mod/greet.js, ./mod/util.js).
3. `./ionpower-node test/fs_smoke.js` — fs/path round-trip.
4. `./ionpower-node test/timers_smoke.js` — setImmediate/setTimeout
   (synchronous, documented caveat).
5. `./ionpower-node test/console_formatting.js` — object/function
   rendering.
6. `./ionpower-node test/integration.js` — end-to-end assertion
   bundle.
7. `./ionpower-node test/fibonacci.js` — JIT warmup on recursive
   function. Watch that this runs fast.

## 6. Measure

Ratify the perf story:

```bash
# Same script, ionpower-node (JIT on by default).
time ssh imacg52 '/Users/macuser/tmp/ionpower-node/ionpower-node \
    /Users/macuser/tmp/ionpower-node/test/jit_smoke.js'
# Stock js shell with JIT disabled for baseline.
time ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --no-ion --no-baseline \
    /Users/macuser/tmp/ionpower-node/test/jit_smoke.js'
```

Capture the ratio in `docs/perf.md` (to be written once numbers
exist).

## 7. Distribute-ready checklist (if we get that far)

- [ ] `tiger.sh` recipe at
  `leopard.sh/tigersh/scripts/install-mozjs-45-ionpower-g5.sh`,
  mirroring `install-openssl-1.1.1t.sh` template.
- [ ] Same for g4 (`-mcpu=7450`) and g3 (`-mcpu=750`). Each
  rebuilds SpiderMonkey with its CPU tune and installs under
  `/opt/mozjs-45-ionpower-g{3,4,5}/` to coexist.
- [ ] `tiger.sh` recipe for ionpower-node itself that picks the
  matching mozjs install for the host CPU.
- [ ] README updated with an "install" section pointing at
  `tiger.sh ionpower-node-0.1`.

## 8. If things break after 10 minutes

Go to `docs/fallback-plans.md` and triage in order. The failure
scenarios there are ranked by likelihood. The nuclear option
(§"Worst case") is building upstream `mozjs-45.9.0` on x86_64 to
validate the bridge in isolation before returning to PPC.
