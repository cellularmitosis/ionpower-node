# Building ionpower-node

Three workflows for getting a runtime onto a Tiger PowerPC host.
Pick the one that matches your situation:

- **[Install prebuilt](#install-prebuilt)** — you have a Tiger PPC box,
  no compiler, just want to use the runtime.
- **[Build on one host](#build-on-one-host)** — you have one Tiger PPC
  box and want to build from source.
- **[Triad build](#triad-build-the-projects-release-flow)** — you have a
  three-host fleet (G3 / G4 / G5) and want to mimic the project's
  release flow.

For testing the result once you've built it, see
[`TESTING.md`](TESTING.md).

---

## Install prebuilt

No compiler needed. Two steps: install SpiderMonkey + IonPower JIT
once, then drop in a runtime tarball per release.

### One-time: SpiderMonkey + IonPower JIT

The mozjs build is identical across all our runtime releases — pulled
once from the [v0.73 release](https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.73)
and reused thereafter. Pick the tarball that matches your CPU:

| Arch | Hosts that need this | Tarball |
|---|---|---|
| `g3` | iMac G3, iBook G3, PowerBook G3 — anything with PPC 750 | [`mozjs-45-ionpower-g3.tar.gz`](https://github.com/cellularmitosis/ionpower-node/releases/download/v0.73/mozjs-45-ionpower-g3.tar.gz) (90 MB) |
| `g4` | eMac, iBook G4, PowerBook G4, Mac mini G4, Power Mac G4 — anything with PPC 7400 / 7450 | [`mozjs-45-ionpower-g4.tar.gz`](https://github.com/cellularmitosis/ionpower-node/releases/download/v0.73/mozjs-45-ionpower-g4.tar.gz) (66 MB) |
| `g5` | Power Mac G5, iMac G5, Xserve G5 — anything with PPC 970 | [`mozjs-45-ionpower-g5.tar.gz`](https://github.com/cellularmitosis/ionpower-node/releases/download/v0.73/mozjs-45-ionpower-g5.tar.gz) (66 MB) |

```bash
# G3 example. For G4 / G5, just swap the suffix.
curl -L -O https://github.com/cellularmitosis/ionpower-node/releases/download/v0.73/mozjs-45-ionpower-g3.tar.gz
sudo tar xzpf mozjs-45-ionpower-g3.tar.gz -C /opt/
```

This unpacks to `/opt/mozjs-45-ionpower-g3/` (or `g4`/`g5`). The
runtime tarball expects to find this directory there.

### Per release: the runtime

```bash
curl -L -O https://github.com/cellularmitosis/ionpower-node/releases/latest/download/ionpower-node-0.82-g3-ppc.tar.gz
sudo tar xzpf ionpower-node-0.82-g3-ppc.tar.gz -C /opt/

# Sanity check
echo "console.log(process.version, process.arch)" > /tmp/v.js
/opt/ionpower-node-0.82/bin/node /tmp/v.js
# -> ionpower-node-0.82 ppc
```

### Final layout

```
/opt/
├── mozjs-45-ionpower-g3/        ← SpiderMonkey + IonPower JIT (-mcpu=750)
│   ├── bin/, include/, lib/...
└── ionpower-node-0.82/          ← runtime
    └── bin/node                 ← expects sibling /opt/mozjs-45-ionpower-g3/
```

For G4 hosts, both `mozjs-45-ionpower-g4` and the matching G4 runtime
tarball; ditto G5. Native pairs are fastest, but the PPC instruction
set is forward-compatible:

| Build | Runs on G3 | Runs on G4 | Runs on G5 |
|---|:---:|:---:|:---:|
| G3 (`-mcpu=750`, no AltiVec) | ✅ | ✅ | ✅ |
| G4 (`-mcpu=7450`, uses AltiVec) | ❌ | ✅ | ✅ |
| G5 (`-mcpu=G5`, 64-bit-aware) | ❌ | ❌ | ✅ |

In practice the install *feels* arch-locked because the bundled
SpiderMonkey at `/opt/mozjs-45-ionpower-{g3,g4,g5}/` was compiled
with each arch's `-mcpu` flag — the G4 mozjs uses AltiVec in
autovec'd loops, which crashes on G3. So the lock comes from mozjs,
not from our runtime binary.

Concretely: a G3 *runtime tarball* paired with the G3 *mozjs install*
runs fine on a G5 box. Just slower than a G5-native pair. If you've
got a heterogenous fleet, the G3 build is the lowest-common-denominator
that runs everywhere.

---

## Build on one host

Same prereq as above: `/opt/mozjs-45-ionpower-{g3,g4,g5}/` already
present. Plus a working `gcc-4.9` toolchain (Tiger's stock gcc-4.0
won't compile our `globals.cpp`).

### Toolchain check

The build hosts the project uses have:

```
/opt/gcc-4.9.4/bin/g++-4.9      ← required (or symlinked at /usr/local/bin/g++-4.9)
/usr/sbin/sysctl                ← stock Tiger
/bin/hostname                   ← stock Tiger
```

A G5 build additionally needs **GNU make ≥ 4.x** at
`/opt/make-4.3/bin/make` — Tiger's stock `make 3.80` chokes on the
rules. G3 / G4 builds work with stock make.

If you don't already have gcc-4.9 + (for G5) make-4.3, see the
project's PowerPC fleet bootstrap docs in
[`docs/build-notes.md`](docs/build-notes.md). Once present they're
permanent.

### Build

```bash
# 1. Get the source onto the PPC host. Any of:
git clone https://github.com/cellularmitosis/ionpower-node ~/tmp/ionpower-node
# - or -
rsync -a /path/to/cloned/copy/ user@host:~/tmp/ionpower-node/

# 2. Build, with arch-specific flags.
cd ~/tmp/ionpower-node
make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g3 CPU_FLAGS="-mcpu=750 -mtune=750"
#                  └─ change for g4 / g5 ─┘  └────── change for g4 / g5 ─────┘
```

Arch-specific flag table:

| Arch | `MOZJS_PREFIX` | `CPU_FLAGS` | `MAKE` |
|---|---|---|---|
| `g3` | `/opt/mozjs-45-ionpower-g3` | `-mcpu=750 -mtune=750` | `make` (stock) |
| `g4` | `/opt/mozjs-45-ionpower-g4` | `-mcpu=7450 -mtune=7450` | `make` (stock) |
| `g5` | `/opt/mozjs-45-ionpower-g5` | `-mcpu=G5 -D_PPC970_` | `/opt/make-4.3/bin/make` |

A clean build takes:
- ~6 min on a G3 600 MHz iMac
- ~3 min on a G3 900 MHz iBook (`ibookg37`, the project's canonical G3)
- ~2 min on an eMac G4
- ~1 min on a Power Mac G5

Output: `./node` in the source-tree root. That's the runtime.

### Quick sanity check

```bash
./node test/hello.js
```

If that prints `hello world` and exits 0, you're done.

### Install (optional)

```bash
sudo make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g3 install PREFIX=/opt/ionpower-node-mybuild
```

Drops the binary, the vendored Babel + tweetnacl + node-forge +
elliptic, and `LICENSE` / `README.md` under `/opt/ionpower-node-mybuild/`.
Optional — for development iteration, just run from the source tree
(`./node ...`).

---

## Triad build (the project's release flow)

What we use to cut a release. Drives a one-host-per-arch fleet from
your dev box: rsync the source to the PPC host, build, run all tests,
install to `/opt`, tarball the result.

Edit [`scripts/triad-build.sh`](scripts/triad-build.sh) to point at
your hosts. Defaults are the project's:

| Arch | Default host | What it is |
|---|---|---|
| `g3` | `ibookg37` | iBook G3, PowerBook4,3, 900 MHz, 640 MB RAM |
| `g4` | `emac` | eMac G4, 7450 |
| `g5` | `pmacg5` | Power Mac G5, 970 |

Each host needs:
- `/opt/mozjs-45-ionpower-{g3,g4,g5}/` installed (one-time)
- Working `gcc-4.9` toolchain
- (G5 only) `/opt/make-4.3/bin/make`
- ssh-reachable from your dev box, with key auth (no password prompts
  during the build)

Then from your dev box, in the project root:

```bash
scripts/triad-build.sh g3 0.82
scripts/triad-build.sh g4 0.82
scripts/triad-build.sh g5 0.82
```

You can pass an explicit host name as the first arg if you want to
override the default for a given arch — e.g. `scripts/triad-build.sh
imacg3 g3 0.82`.

The script:
1. rsyncs your dev-box source to `<host>:/Users/macuser/tmp/ionpower-node/`
2. scp's a few files explicitly (workaround for an old rsync gremlin)
3. `make clean && make` with the right flags
4. `make test-all` — runs the full smoke suite. Retries once if the
   first run fails (catches G5 timer flakes)
5. `make install PREFIX=/opt/ionpower-node-<ver>`
6. Tarballs `/opt/ionpower-node-<ver>` to `/tmp/ionpower-node-<ver>-<arch>-ppc.tar.gz`

8–15 minutes per arch, depending on host. Can be run in parallel —
the project commonly fires all three at once via `run_in_background`.

When all three are green, pull the tarballs:

```bash
mkdir -p /tmp/v0.82-release && cd /tmp/v0.82-release
scp ibookg37:/tmp/ionpower-node-0.82-g3-ppc.tar.gz .
scp emac:/tmp/ionpower-node-0.82-g4-ppc.tar.gz .
scp pmacg5:/tmp/ionpower-node-0.82-g5-ppc.tar.gz .
```

That's the artifact set every GitHub Release of the project ships.

---

## Cleaning up

```bash
make clean             # remove .o files and ./node from the source tree
sudo rm -rf /opt/ionpower-node-0.82
```

The mozjs install at `/opt/mozjs-45-ionpower-g3/` is intentionally
permanent — every runtime release reuses it.

---

## Troubleshooting

**`ld: library not found for -lcrt1.10.6.o`**

You're using gcc-4.9 without `-mmacosx-version-min=10.4`. That flag
is in our Makefile by default; if you're invoking gcc-4.9 directly,
pass it.

**`make: ./node: Command not found` mid-test-suite**

This means an earlier test crashed or `./node` was deleted between
build and test. Re-run `make`. (Some test files used to delete
`./node` accidentally — that bug is fixed but worth a sanity check.)

**G5 build chokes on `=` in a Makefile rule**

You're using stock Tiger `make 3.80` instead of `make-4.3`. Add
`MAKE=/opt/make-4.3/bin/make` to your invocation, or symlink it.

**`No module named 'mozbase'` during a from-scratch SpiderMonkey
build**

Sparse-checkout of the TenFourFox tree is missing `testing/mozbase/`.
Re-fetch with that path included. (Only relevant if you're rebuilding
SpiderMonkey itself, not the runtime — see `scripts/build-mozjs.sh`.)

**`Error: bind: Address already in use`**

A previous server instance is still running. `pkill -f
"demos/<name>/server"` and try again. If that doesn't work, find the
PID with `ps ax | grep node` and `kill -9` it.
