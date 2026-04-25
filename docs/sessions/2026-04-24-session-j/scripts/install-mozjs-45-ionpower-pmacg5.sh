#!/opt/tigersh-deps-0.1/bin/bash
# based on templates/build-from-source.sh v6, adapted for Mozilla 45 standalone.
#
# Install SpiderMonkey 45 with TenFourFox's IonPower PPC backend, built for a
# G5 host (-mcpu=G5 -D_PPC970_). Target prefix: /opt/mozjs-45-ionpower-g5.
#
# Later copies of this script (for G3 / G4) differ only in CPU flags and
# prefix suffix.

package=mozjs-45-ionpower
version=g5
upstream_source=https://github.com/classilla/tenfourfox

set -e -o pipefail
PATH=/opt/autoconf-2.13/bin:/opt/python2-2.7.18/bin:/opt/tigersh-deps-0.1/bin:$PATH
export PATH
SCRATCH=/Users/macuser/tmp
CA=/opt/ca-certificates-20230110/share/cacert.pem

pkgspec=$package-$version

echo -n -e "\033]0;tiger.sh $pkgspec ($(tiger.sh --cpu))\007"

# Binpkg short-circuit (not yet built/published; placeholder for the tigersh
# convention).
if tiger.sh --install-binpkg $pkgspec 2>/dev/null; then
    exit 0
fi

echo "Building $pkgspec from source." >&2

# Prereqs.
for dep in python2-2.7.18 ca-certificates-20230110; do
    test -e /opt/$dep || tiger.sh $dep
done
if ! test -x /opt/autoconf-2.13/bin/autoconf213; then
    echo "ERROR: autoconf-2.13 required. Build it first using" >&2
    echo "    $SCRATCH/build-autoconf-213.sh" >&2
    exit 1
fi

# Fetch or refresh the source tree.
cd "$SCRATCH"
if [ ! -d tenfourfox-src ]; then
    mkdir -p tenfourfox-src
    # We assume the sparse clone was rsync'd here from the main Mac.
    echo "ERROR: $SCRATCH/tenfourfox-src not populated." >&2
    echo "Run this on the main Mac first:" >&2
    echo "  ~/bin/tiger-rsync.sh --delete --exclude=.git \\" >&2
    echo "     external/tenfourfox/ $(hostname):$SCRATCH/tenfourfox-src/" >&2
    exit 1
fi

SRC="$SCRATCH/tenfourfox-src"

# mozilla-config.h / plvmx.h stubs (see docs/build-notes.md for why).
OBJDIR="$SRC/js/src/build_OPT.OBJ"
mkdir -p "$OBJDIR/dist/include"
echo '#include "js-confdefs.h"' > "$OBJDIR/dist/include/mozilla-config.h"
cp "$SRC/nsprpub/lib/libc/include/plvmx.h" "$OBJDIR/dist/include/plvmx.h"

# Empty ICU stubs to satisfy moz.build path checks (we're --without-intl-api).
mkdir -p "$SRC/intl/icu/source/common" "$SRC/intl/icu/source/i18n"

cd "$SRC/js/src"
autoconf213 || true    # regenerate configure; idempotent on re-runs

cd "$OBJDIR"

PREFIX=/opt/$pkgspec
export MACOSX_DEPLOYMENT_TARGET=10.4
export CC="/opt/gcc-4.9.4/bin/gcc-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=G5 -D_PPC970_ -flax-vector-conversions -O3 -force_cpusubtype_ALL \
-read_only_relocs suppress"
export CXX="/opt/gcc-4.9.4/bin/g++-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=G5 -D_PPC970_ -flax-vector-conversions -fpermissive -O3 \
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

/usr/bin/time /opt/make-4.3/bin/make $(tiger.sh -j)
/usr/bin/time /opt/make-4.3/bin/make install

tiger.sh --linker-check $pkgspec
tiger.sh --arch-check $pkgspec

echo "[done] installed $pkgspec to $PREFIX"
