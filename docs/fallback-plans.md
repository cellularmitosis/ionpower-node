# Fallback plans

What to do if the happy path breaks at a given stage.

## If the mozjs build dies mid-compile

**Symptom**: `make` stops early with a compile error in some .cpp.

**Common culprits**:

- gcc-4.9 is stricter than the gcc-4.8 TenFourFox shipped with. Most
  warnings are tolerated with `-fpermissive` (already in our flags),
  but some `-Werror`-era code may trip. Grep the error message
  against the upstream commit log at
  `git -C external/tenfourfox log --oneline | grep -i <keyword>` —
  TenFourFox's own bug tracker calls out compiler-version issues as
  `gcc-4.x`.
- Header-path breakage when a sparse checkout is still missing a
  dir (Mozilla tree is sprawling — `grep -rn '#include' js/src |
  grep -v '"' | grep 'include <' | sort -u` gives the external
  include needs).

**Mitigation order**:
1. Reduce optimization: drop `-O3` → `-O2` → `-O1`. Some gcc-4.9
   optimizer bugs bite only at `-O3`.
2. Try `/opt/gcc-10.3.0/bin/gcc-10.3` — newer gcc sometimes handles
   what 4.9 can't.
3. Patch the specific file. TenFourFox committed local workarounds
   all over `js/src/jit/` for PowerPC; applying them selectively
   is usually tractable.
4. Ultimate fallback: disable the JIT via configure (`--enable-ion=no
   --enable-baseline=no` if those flags exist) and build an
   interpreter-only mozjs. We lose the performance story but the
   bridge still works.

## If the build finishes but the install dir has no `libmozjs-45.a`

**Symptom**: `make install` completes but only NSPR / mozglue /
mfbt libs are in `/opt/mozjs-45-ionpower/lib/`.

This happens when `--disable-shared-js` changes how `js/src` installs.
In some configurations the static library ends up at
`js/src/build_OPT.OBJ/js/src/libjs_static.a` and only copies to
`/opt/...` under specific target names. Confirm with:

```bash
ssh imacg52 'find /Users/macuser/tmp/tenfourfox/js/src/build_OPT.OBJ \
             -name "libjs_static*" -o -name "libmozjs-45*"'
```

**Mitigation**: copy the file manually into the install prefix and
adjust the Makefile's `-lmozjs-45` → `-ljs_static`.

## If linking the bridge fails with undefined NSPR symbols

**Symptom**: `ld: symbol(s) not found for architecture ppc ...
_PR_GetCurrentThread` etc.

When we pass `--disable-shared-js`, NSPR symbols still need to resolve
at link time. The standalone mozjs build uses a "posix-wrapper" NSPR
(see the configure line `checking NSPR selection... posix-wrapper`),
which is statically linked into `libjs_static.a`. But if the build
doesn't bundle them, we need to link NSPR explicitly.

**Mitigation**: link against the in-tree NSPR:

```
LDLIBS += -L /opt/mozjs-45-ionpower/lib -lnspr4 -lplds4 -lplc4
```

Or rebuild with `--with-system-nspr` pointing to a `/opt/nspr-<ver>/`
(would require an NSPR install first).

## If linking succeeds but `./ionpower-node test/hello.js` crashes

Common causes in order:

1. **Missing `JS_FireOnNewGlobalObject`** or wrong compartment order
   → assert on first `JS_NewPlainObject`. Fixable in `src/main.cpp`
   without rebuilding mozjs.
2. **Mismatch of `JSVersion` enum** between what the headers expose
   and what the `.a` was built with → link-time works but a
   version-dispatch in the VM crashes. Extremely rare; fix by
   dropping the `setVersion(JSVERSION_LATEST)` in `main.cpp` and
   letting the default apply.
3. **Root leak / unrooted value** → SpiderMonkey 45's GC is moving.
   Crashes manifest as "value landed on weird type" or assertion
   failures in GC. Audit `src/node_compat/*.cpp` for any `JSObject*`
   / `JSString*` / `Value` held without `Rooted<T>`. Our current
   code looks right but this is the first thing to check.

## If the JIT never appears to run

**Symptom**: `verify_jit.js` runs at the same speed with and without
`--no-ion --no-baseline`.

**Check** `js-confdefs.h` in the build dir for
`JS_CODEGEN_PPC_OSX`. If absent, configure didn't detect PPC —
`CPU_ARCH` was wrong. Force it: configure with
`--target=powerpc-apple-darwin8.11.0` (already in build-mozjs.sh).

**Check** `js --help | grep -iE 'ion|baseline'` — if there are no
such flags, the JIT is fully compiled out. Unusual; would indicate
a moz.build oversight in the standalone subtree.

## Worst case: cross-arch development fallback

If the entire PPC build infrastructure stays broken, we can at least
validate the Node-compat bridge logic on a modern Mac / Linux:

1. Build upstream `mozjs-45.9.0` tarball on x86_64 (much easier
   path — no IonPower, just stock SpiderMonkey).
2. Link the bridge source against the x86_64 mozjs-45.
3. Run the same tests. This confirms the bridge is correct in
   isolation; all that remains is the IonPower-specific build for
   PPC.

We don't pursue this unless the PPC path is truly blocked — but it
de-risks the Node-bridge half of the work.
