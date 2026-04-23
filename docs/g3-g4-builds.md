# Building SpiderMonkey 45 for G3 and G4

The G5 recipe at [scripts/install-mozjs-45-ionpower-g5.sh](../scripts/
install-mozjs-45-ionpower-g5.sh) is the canonical path; G3 and G4 are
copies of it with `-mcpu` and the `-falign-*` cache-line hints
adjusted to the target ISA. Install prefixes are versioned so all
three can coexist at `/opt/mozjs-45-ionpower-g{3,4,5}`.

| CPU | Script | `-mcpu` / `-mtune` | `-falign-*` | Hosts tried |
|---|---|---|---|---|
| G5 (970) | install-mozjs-45-ionpower-g5.sh | `G5` + `-D_PPC970_` | 32 | imacg52 (2 GHz) |
| G4 (7450) | install-mozjs-45-ionpower-g4.sh | `7450` | 16 | emac |
| G3 (750)  | install-mozjs-45-ionpower-g3.sh | `750` | — | imacg3 |

## imacg3 bootstrap (host-specific surprises)

The G5 recipe was authored on imacg52, which had already been used for
a round of tigersh package installs. Bringing imacg3 up to build the
same sources required three extra fixes, in this order:

### 1. `pip` missing from `/opt/python2-2.7.18/`

Tiger's `tiger.sh python2-2.7.18` install script leaves `site-packages`
empty on a fresh machine; imacg52 had `pip 20.3.4` and `setuptools
41.2.0` already installed there from earlier runs. Mozbuild's bundled
`virtualenv.py` ships a `pip-6.0.6` wheel that triggers an
`ImportError: No module named 'pip._vendor.requests'` when the
outer Python has no pip at all.

**Fix:** copy imacg52's `/opt/python2-2.7.18/lib/python2.7/site-packages`
to imacg3 before the mozjs build runs:

```bash
ssh imacg52 'cd /opt/python2-2.7.18/lib/python2.7/site-packages && \
    tar czf /tmp/site-packages-imacg52.tgz pip pip-20.3.4.dist-info \
    pkg_resources setuptools setuptools-41.2.0.dist-info \
    easy_install.py easy_install.pyc'
scp imacg52:/tmp/site-packages-imacg52.tgz /tmp/
scp /tmp/site-packages-imacg52.tgz imacg3:/tmp/
ssh imacg3 'cd /opt/python2-2.7.18/lib/python2.7/site-packages && \
    tar xzf /tmp/site-packages-imacg52.tgz'
```

After that, `/opt/python2-2.7.18/bin/python2 -c "import pip"` succeeds.

### 2. mozbuild's virtualenv call needs `--system-site-packages --no-pip --no-setuptools`

The `virtualenv_support/pip-6.0.6-py2.py3-none-any.whl` wheel embedded
in the tenfourfox sparse tree still fails to import even with system
pip present, inside the new virtualenv. It's specifically the bundled
wheel's `pip/_vendor/__init__.py` that's broken on Python 2.7.18 +
this OS.

**Fix:** patch the virtualenv invocation in
`python/mozbuild/mozbuild/virtualenv.py` line ~140 to pass
`--system-site-packages --no-pip --no-setuptools`. The script
`install-mozjs-45-ionpower-g{3,4}.sh` applies this patch idempotently
as an in-place `perl -i -pe` rewrite guarded by `IONPOWER_VENV_FLAGS`.

### 3. GNU make ≥ 3.81

Tiger ships `/usr/bin/make` at GNU Make 3.80. Mozilla's Makefile.in
has a hard version gate and aborts with `*** GNU Make 3.81 or higher
is required.  Stop.` On imacg52, `/usr/local/bin/make` is a symlink
to `/opt/make-4.3/bin/make` from a prior tigersh install. On imacg3,
the binpkg wasn't present.

**Fix:** `tiger.sh make-4.3` (which `install-make-4.3.sh` wraps)
installs a ppc750-targeted 4.3 into `/opt/make-4.3/bin/`. The G3 and
G4 scripts prepend that path to `PATH` so configure's make-detection
picks it up. The existing `/opt/make-4.3/bin/make` on imacg52 is a
`ppc970` build; it won't run on G3/G4.

## Sequence summary

On a fresh host, the minimum bootstrap is:

1. `ssh <host> tiger.sh python2-2.7.18` (or equivalent)
2. Prime `/opt/python2-2.7.18/lib/python2.7/site-packages` with a
   working pip+setuptools copy (see (1) above)
3. `scp scripts/build-autoconf-213.sh <host>:/Users/macuser/tmp/ &&
    ssh <host> '/Users/macuser/tmp/build-autoconf-213.sh'`
4. `ssh <host> tiger.sh make-4.3`
5. `~/bin/tiger-rsync.sh --delete --exclude=.git
    external/tenfourfox/ <host>:/Users/macuser/tmp/tenfourfox-src/`
6. `scp scripts/install-mozjs-45-ionpower-g{3,4}.sh <host>:/Users/macuser/tmp/`
7. `ssh <host> 'nohup /Users/macuser/tmp/install-mozjs-45-ionpower-g{3,4}.sh
    > /Users/macuser/tmp/build-mozjs-g{3,4}.log 2>&1 &'`
8. poll `tail /Users/macuser/tmp/build-mozjs-g{3,4}.log`

Build runs take several hours on G3 — the iMac G3 is a single-core
~700 MHz chip. Expect 5–8 hours end-to-end; imacg52 did the same
sources in ~3 hours at 2 GHz with the 970.

## Verification smoke

After `make install` lands:

```bash
ssh <host> 'DYLD_LIBRARY_PATH=/opt/mozjs-45-ionpower-g{3,4}/lib \
    /opt/mozjs-45-ionpower-g{3,4}/bin/js \
    -e "print(\"hello from \"+Math.sqrt(2))"'
```

The G5 artifact at imacg52 has been printing `hello from
1.4142135623730951` reliably for weeks. The G3 artifact at imacg3
printed the same 2026-04-22.

Then rebuild ionpower-node against the new prefix and rerun
`make test-all` — the 600+ `ok:` checkpoints are the real
integration smoke.

## Gotcha: dsymutil is slow (but finishes) on a G3

The link step of `js/src/shell/js` invokes `dsymutil js` to build a
.dSYM bundle from the 8.8 MB binary's embedded DWARF debug info.
On a G3 iMac (~700 MHz), this step runs in **~15.7 minutes**
(941 s real time, 902 s user, 19 s sys; measured 2026-04-22) at
165–250 MB RSS and produces a 68 MB DWARF archive under
`js.dSYM/Contents/Resources/DWARF/js`.

The original build-session observation that dsymutil "didn't
finish in 30 min" turned out to be partially a flaky Claude
session plus a concurrent network outage — a clean retest on the
same G3 binary finished reliably at the timing above. Still a
substantial chunk of total build time; if you don't need debug
symbols, skip it with the workaround below.

**Workaround:** once you confirm the `js` binary itself exists at
`js/src/build_OPT.OBJ/js/src/shell/js`, kill dsymutil with SIGTERM
— make will exit with an error. Then manually copy the artifacts:

```bash
ssh imacg3 '
OBJDIR=/Users/macuser/tmp/tenfourfox-src/js/src/build_OPT.OBJ
PREFIX=/opt/mozjs-45-ionpower-g3
mkdir -p $PREFIX/bin $PREFIX/lib
cp $OBJDIR/js/src/shell/js                   $PREFIX/bin/js
cp $OBJDIR/mozglue/build/libmozglue.dylib    $PREFIX/lib/
# libjs_static.a may land with a mangled name if make exited mid-install;
# fix it:
[ -f $PREFIX/lib/libjs_static.ajs ] && \
    mv $PREFIX/lib/libjs_static.ajs $PREFIX/lib/libjs_static.a
DYLD_LIBRARY_PATH=$PREFIX/lib $PREFIX/bin/js -e "print(Math.sqrt(2))"
'
```

The cleaner long-term fix is to strip `-gdwarf-2` from the CFLAGS in
the install script so dsymutil has nothing to process. That's a
one-line change to `install-mozjs-45-ionpower-g{3,4}.sh`; pending
validation.

## G4 install artifacts (emac, 2026-04-23)

After the Xcode 2.5 install unblocked `/usr/lib/crt1.o` +
`/Developer/SDKs/MacOSX10.4u.sdk`, the G4 build ran to completion
overnight on emac (1.42 GHz 7450, 1 GB RAM). Install at
`/opt/mozjs-45-ionpower-g4/`:

```
bin/js                   9.5 MB, ppc
bin/js-config
lib/libjs_static.a     212 MB (renamed from libjs_static.ajs post-install;
                              same Mozilla-install quirk as G3)
lib/libmozglue.dylib   151 KB (cp'd from OBJDIR after install; see G3 note)
include/mozjs-45/      16 headers
```

Smoke: `print(Math.sqrt(2))` → `1.4142135623730951`. JIT bench:
5 M integer-sum loop in **47 ms** — fastest of the three targets:

    G3 @ 700 MHz   254 ms
    G5 @ 2.00 GHz  ~120 ms
    G4 @ 1.42 GHz   47 ms

The G4's ~2.5× advantage over the G5 at lower clock is the result we
hoped for from `-mcpu=7450 -mtune=7450 -falign-*=16` (matching the
G4's 32-byte cache-line design versus the G5's 128-byte setup that we
over-aligned to in the G5 build's `-falign-*=32`). IonPower is happy
on this shape.

## G3 install artifacts (imacg3, 2026-04-22)

After the manual install step above:

```
/opt/mozjs-45-ionpower-g3/bin/js          (8.8 MB, ppc750 Mach-O)
/opt/mozjs-45-ionpower-g3/bin/js-config
/opt/mozjs-45-ionpower-g3/lib/libjs_static.a    (220 MB static archive)
/opt/mozjs-45-ionpower-g3/lib/libmozglue.dylib  (124 KB)
/opt/mozjs-45-ionpower-g3/include/mozjs-45/{jsapi,jsfriendapi,...}.h
```

Smoke: `print(Math.sqrt(2))` returns `1.4142135623730951`. A
5-million-iteration integer-sum loop completes in ~250 ms on a 700 MHz
G3 — roughly 2× the G5's time as expected for the clock-rate
difference.
