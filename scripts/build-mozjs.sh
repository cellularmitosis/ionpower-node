#!/opt/tigersh-deps-0.1/bin/bash
# Build standalone SpiderMonkey (mozjs) from the TenFourFox source tree on
# the G5 (imacg52). Run after sync-tenfourfox-to-g5 has populated
# /Users/macuser/tmp/tenfourfox/.
set -e -o pipefail
PATH=/opt/autoconf-2.13/bin:/opt/python2-2.7.18/bin:/opt/tigersh-deps-0.1/bin:$PATH

SRC=/Users/macuser/tmp/tenfourfox
PREFIX=/opt/mozjs-45-ionpower
OBJDIR="$SRC/js/src/build_OPT.OBJ"

cd "$SRC/js/src"

# Regenerate configure from configure.in using autoconf 2.13.
echo "[step] autoconf213"
autoconf213
# mfbt needs its own configure too? In Firefox 45 era, js/src's configure
# includes mfbt support internally. We'll trust it.

echo "[step] mkdir objdir"
rm -rf "$OBJDIR"
mkdir -p "$OBJDIR"
cd "$OBJDIR"

# Compiler setup: match TenFourFox's G5.mozcfg as closely as possible.
# gcc-4.9.4 is what TenFourFox built with originally (they used gcc-mp-4.8
# from MacPorts; 4.9 is a close match and available in /opt here).
# Use -m32 (the IonPower JIT is 32-bit only).
export MACOSX_DEPLOYMENT_TARGET=10.4
# -mmacosx-version-min=10.4 makes the linker pick /usr/lib/crt1.o (the
# Tiger CRT) rather than the default Leopard+ crt1.10.6.o, which doesn't
# exist on 10.4. See session-B's notes in docs/status-report-session-B.md
# for the failure mode this prevents.
export CC="/opt/gcc-4.9.4/bin/gcc-4.9 -m32 -mmacosx-version-min=10.4 -mcpu=G5 -D_PPC970_ -flax-vector-conversions -O3 -force_cpusubtype_ALL -read_only_relocs suppress"
export CXX="/opt/gcc-4.9.4/bin/g++-4.9 -m32 -mmacosx-version-min=10.4 -mcpu=G5 -D_PPC970_ -flax-vector-conversions -fpermissive -O3 -force_cpusubtype_ALL -read_only_relocs suppress"
export AR=ar
export RANLIB=ranlib
export PYTHON=/opt/python2-2.7.18/bin/python2
export AUTOCONF=/opt/autoconf-2.13/bin/autoconf213

echo "[step] configure"
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
    --disable-icu \
    2>&1 | tee configure.log

echo "[step] make"
make 2>&1 | tee build.log

echo "[step] make install"
make install 2>&1 | tee install.log

echo "[done] SpiderMonkey built. Artifacts:"
ls -la "$PREFIX"/lib/ 2>/dev/null || true
ls -la "$OBJDIR"/dist/bin/js 2>/dev/null || true
