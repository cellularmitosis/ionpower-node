# From-scratch setup on a Tiger fleet host

Starting assumption: a Power Mac running Mac OS X 10.4 Tiger with
`macuser` SSH access, `tiger.sh` available at `/usr/local/bin/tiger.sh`,
and the usual TigerTube fleet layout (see `../../TigerTube/docs/fleet/
fleet.md`). Target host in this recipe: `imacg52` (G5 2.0 GHz), chosen
for speed. Substitute another Tiger host if you want.

## 1. Install /opt prereqs (~5 min)

```bash
ssh imacg52 'tiger.sh python2-2.7.18'   # mozbuild needs Python 2.7
ssh imacg52 'ls /opt/gcc-4.9.4 2>/dev/null || tiger.sh gcc-4.9.4'
```

Xcode 2.5 / `MacOSX10.4u.sdk` should already be installed on any
TigerTube host; if not, `tiger.sh xcode-2.5`.

## 2. Build autoconf 2.13 (~2 min)

Mozilla's `configure.in` refuses any autoconf other than 2.13.

```bash
scp scripts/build-autoconf-213.sh imacg52:/Users/macuser/tmp/
ssh imacg52 '/Users/macuser/tmp/build-autoconf-213.sh'
```

Artifact: `/opt/autoconf-2.13/bin/autoconf213` (and friends).

## 3. Pull the TenFourFox source (~1 min)

From the main Mac:

```bash
cd ionpower-node
git -C external/tenfourfox pull          # only if re-syncing
~/bin/tiger-rsync.sh --delete \
    --exclude=.git --exclude='*.pyc' \
    external/tenfourfox/ imacg52:/Users/macuser/tmp/tenfourfox/
ssh imacg52 'mkdir -p /Users/macuser/tmp/tenfourfox/intl/icu/source/common \
                       /Users/macuser/tmp/tenfourfox/intl/icu/source/i18n'
```

(The empty ICU stubs satisfy `moz.build`'s path validation without
requiring us to ship the real ICU tree, since we configure with
`--without-intl-api --disable-icu`.)

## 4. Configure + build SpiderMonkey (~hours)

Run in background because a G5 takes ~2-4 hours. Run foreground at
your peril (an ssh drop kills the build).

```bash
scp scripts/build-mozjs.sh imacg52:/Users/macuser/tmp/
ssh imacg52 'chmod +x /Users/macuser/tmp/build-mozjs.sh;
             nohup /Users/macuser/tmp/build-mozjs.sh \
               > /Users/macuser/tmp/build-mozjs.log 2>&1 &'
```

Poll:

```bash
ssh imacg52 'tail -20 /Users/macuser/tmp/build-mozjs.log'
```

Artifacts when done:
- `/opt/mozjs-45-ionpower/bin/js` (standalone shell)
- `/opt/mozjs-45-ionpower/lib/libmozjs-45*.{a,dylib}`
- `/opt/mozjs-45-ionpower/include/mozjs-45/{jsapi.h,...}`

## 5. Verify the JIT

Run the tiny verify script with the JIT on, then off:

```bash
ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --ion-eager \
               /path/to/ionpower-node/test/verify_jit.js'
ssh imacg52 '/opt/mozjs-45-ionpower/bin/js --no-ion --no-baseline \
               /path/to/ionpower-node/test/verify_jit.js'
```

You should see a several-× speedup on the JIT runs. If you don't,
the JIT was built but isn't being selected — check `js --help |
grep -i ion` for the flag set, and double-check that
`JS_CODEGEN_PPC_OSX` was defined in `js-confdefs.h`.

## 6. Build the ionpower-node bridge

```bash
~/bin/tiger-rsync.sh --exclude=.git --exclude=external \
    --exclude=libs . imacg52:/Users/macuser/tmp/ionpower-node/
ssh imacg52 'cd /Users/macuser/tmp/ionpower-node && make'
```

The `Makefile` links against `/opt/mozjs-45-ionpower/lib/libmozjs-45`.

## 7. Run the smoke tests

```bash
ssh imacg52 'cd /Users/macuser/tmp/ionpower-node &&
             ./ionpower-node test/hello.js'
ssh imacg52 'cd /Users/macuser/tmp/ionpower-node &&
             ./ionpower-node test/require_chain.js'
ssh imacg52 'cd /Users/macuser/tmp/ionpower-node &&
             ./ionpower-node test/fs_smoke.js'
```

## Rebuilding on G3/G4 hosts

The IonPower JIT is 32-bit-only and runs on G3, G4, and G5. To
target a G3 (imacg3, pmacg3), change the `mozcfg`-style CPU flags
in `scripts/build-mozjs.sh`:

```
-mcpu=G5 -D_PPC970_    →    -mcpu=750
```

To target a G4 (emac, pbookg42):

```
-mcpu=G5 -D_PPC970_    →    -mcpu=7450
```

See TenFourFox's `G3.mozcfg` / `G4-7450.mozcfg` for the exact flag
sets used in the source browser build.

All three CPU variants produce different .dylibs; we version them
as `/opt/mozjs-45-ionpower-g{3,4,5}` if we want them coresident.
