#!/opt/tigersh-deps-0.1/bin/bash
# Install SpiderMonkey 45 with TenFourFox's IonPower PPC backend, built for a
# G4 host (-mcpu=7450 -mtune=7450). Target prefix: /opt/mozjs-45-ionpower-g4.
#
# Differs from the G5 script only in CPU/cache-line tuning and the install
# prefix; the rest of the TenFourFox/mozbuild plumbing is identical.

package=mozjs-45-ionpower
version=g4
upstream_source=https://github.com/classilla/tenfourfox

set -e -o pipefail
# make-4.3 matters because Mozilla's Makefile.in rejects GNU make < 3.81.
PATH=/opt/make-4.3/bin:/opt/autoconf-2.13/bin:/opt/python2-2.7.18/bin:/opt/tigersh-deps-0.1/bin:$PATH
export PATH
SCRATCH=/Users/macuser/tmp

pkgspec=$package-$version

echo -n -e "\033]0;tiger.sh $pkgspec ($(tiger.sh --cpu))\007"

if tiger.sh --install-binpkg $pkgspec 2>/dev/null; then
    exit 0
fi

echo "Building $pkgspec from source." >&2

for dep in python2-2.7.18 ca-certificates-20230110; do
    test -e /opt/$dep || tiger.sh $dep
done
if ! test -x /opt/autoconf-2.13/bin/autoconf213; then
    echo "ERROR: autoconf-2.13 required. Build it first using" >&2
    echo "    $SCRATCH/build-autoconf-213.sh" >&2
    exit 1
fi

cd "$SCRATCH"
if [ ! -d tenfourfox-src ]; then
    echo "ERROR: $SCRATCH/tenfourfox-src not populated." >&2
    echo "Run this on the main Mac first:" >&2
    echo "  ~/bin/tiger-rsync.sh --delete --exclude=.git \\" >&2
    echo "     external/tenfourfox/ $(hostname):$SCRATCH/tenfourfox-src/" >&2
    exit 1
fi

SRC="$SCRATCH/tenfourfox-src"

OBJDIR="$SRC/js/src/build_OPT.OBJ"
mkdir -p "$OBJDIR/dist/include"
echo '#include "js-confdefs.h"' > "$OBJDIR/dist/include/mozilla-config.h"
cp "$SRC/nsprpub/lib/libc/include/plvmx.h" "$OBJDIR/dist/include/plvmx.h"
mkdir -p "$SRC/intl/icu/source/common" "$SRC/intl/icu/source/i18n"

# PosixNSPR.cpp: short-circuit pthread_setname_np (Leopard-only) on Tiger.
# Idempotent — skip if already patched.
NSPRFILE="$SRC/js/src/vm/PosixNSPR.cpp"
if ! grep -q 'IONPOWER_TIGER_NOSETNAME' "$NSPRFILE"; then
    /opt/perl-5.36.0/bin/perl -i -pe '
        s|^(PR_SetCurrentThreadName\(const char\* name\)\n\{)|${1}\n    // IONPOWER_TIGER_NOSETNAME: pthread_setname_np is Leopard-only.\n    (void)name;\n    return PR_SUCCESS;|' \
        "$NSPRFILE" || true
fi

# See G3 script / docs/g3-g4-builds.md for rationale. Idempotent.
VENVFILE="$SRC/python/mozbuild/mozbuild/virtualenv.py"
if ! grep -q 'IONPOWER_VENV_FLAGS' "$VENVFILE"; then
    /opt/perl-5.36.0/bin/perl -i -pe '
        s|^(        args = \[sys.executable, self.virtualenv_script_path,)|        # IONPOWER_VENV_FLAGS: pip-6.0.6 wheel in virtualenv_support is buggy.\n\1|;
        s|^(            self.virtualenv_root\])|            "--system-site-packages", "--no-pip", "--no-setuptools",\n\1|' \
        "$VENVFILE"
fi

cd "$SRC/js/src"
autoconf213 || true

cd "$OBJDIR"

PREFIX=/opt/$pkgspec
export MACOSX_DEPLOYMENT_TARGET=10.4
# G4 cache-line hints: -falign-*=16 (half the G5's 32-byte alignment).
export CC="/opt/gcc-4.9.4/bin/gcc-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=7450 -mtune=7450 -flax-vector-conversions -O3 \
-falign-loops=16 -falign-functions=16 -falign-labels=16 -falign-jumps=16 \
-force_cpusubtype_ALL -read_only_relocs suppress"
export CXX="/opt/gcc-4.9.4/bin/g++-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=7450 -mtune=7450 -flax-vector-conversions -fpermissive -O3 \
-falign-loops=16 -falign-functions=16 -falign-labels=16 -falign-jumps=16 \
-force_cpusubtype_ALL -read_only_relocs suppress"
export PYTHON=/opt/python2-2.7.18/bin/python2
export AUTOCONF=/opt/autoconf-2.13/bin/autoconf213

../configure \
    --prefix="$PREFIX" \
    --target=powerpc-apple-darwin8.11.0 \
    --host=powerpc-apple-darwin8.11.0 \
    --build=powerpc-apple-darwin8.11.0 \
    --with-macos-sdk=/Developer/SDKs/MacOSX10.4u.sdk \
    --enable-macos-target=10.4 \
    --disable-tests \
    --disable-jemalloc \
    --disable-debug \
    --enable-optimize \
    --disable-cpp-exceptions \
    --disable-strip \
    --disable-install-strip \
    --disable-shared-js \
    --enable-ctypes=no \
    --without-intl-api \
    --disable-icu

/usr/bin/time make $(tiger.sh -j)
/usr/bin/time make install

tiger.sh --linker-check $pkgspec 2>/dev/null || true
tiger.sh --arch-check $pkgspec 2>/dev/null || true

echo "[done] installed $pkgspec to $PREFIX"
