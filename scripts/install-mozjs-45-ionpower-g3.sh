#!/opt/tigersh-deps-0.1/bin/bash
# Install SpiderMonkey 45 with TenFourFox's IonPower PPC backend, built for a
# G3 host (-mcpu=750). Target prefix: /opt/mozjs-45-ionpower-g3.

package=mozjs-45-ionpower
version=g3
upstream_source=https://github.com/classilla/tenfourfox

set -e -o pipefail
# make-4.3 matters because Mozilla's Makefile.in rejects GNU make < 3.81;
# Tiger ships 3.80 at /usr/bin/make.
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

NSPRFILE="$SRC/js/src/vm/PosixNSPR.cpp"
if ! grep -q 'IONPOWER_TIGER_NOSETNAME' "$NSPRFILE"; then
    /opt/perl-5.36.0/bin/perl -i -pe '
        s|^(PR_SetCurrentThreadName\(const char\* name\)\n\{)|${1}\n    // IONPOWER_TIGER_NOSETNAME: pthread_setname_np is Leopard-only.\n    (void)name;\n    return PR_SUCCESS;|' \
        "$NSPRFILE" || true
fi

cd "$SRC/js/src"
autoconf213 || true

cd "$OBJDIR"

PREFIX=/opt/$pkgspec
export MACOSX_DEPLOYMENT_TARGET=10.4
# G3 == 750. No altivec, no _PPC970_, no -mmfcrf.
export CC="/opt/gcc-4.9.4/bin/gcc-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=750 -mtune=750 -flax-vector-conversions -O3 \
-force_cpusubtype_ALL -read_only_relocs suppress"
export CXX="/opt/gcc-4.9.4/bin/g++-4.9 -m32 -mmacosx-version-min=10.4 \
-mcpu=750 -mtune=750 -flax-vector-conversions -fpermissive -O3 \
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
