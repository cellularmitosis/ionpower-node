#!/bin/bash
# Triad build for v0.23 — one host. Usage: triad-v0.23.sh <host> <arch>
# arch = g3 | g4 | g5
set -e
HOST=$1
ARCH=$2
REMOTE=/Users/macuser/tmp/ionpower-node
VERSION=0.23
TARBALL=ionpower-node-${VERSION}-${ARCH}-ppc.tar.gz

case $ARCH in
    g3) MOZJS=/opt/mozjs-45-ionpower-g3; CPU='-mcpu=750 -mtune=750';      MAKE=make ;;
    g4) MOZJS=/opt/mozjs-45-ionpower-g4; CPU='-mcpu=7450 -mtune=7450';    MAKE=make ;;
    g5) MOZJS=/opt/mozjs-45-ionpower-g5; CPU='-mcpu=G5 -D_PPC970_';       MAKE=/opt/make-4.3/bin/make ;;
    *)  echo "unknown arch: $ARCH"; exit 1 ;;
esac

# Make arguments shared by build/install/test.
MAKE_ARGS="MOZJS_PREFIX=$MOZJS CPU_FLAGS=\"$CPU\""

echo "=== [$HOST/$ARCH] rsync source ==="
~/bin/tiger-rsync.sh --delete \
    --exclude=.git --exclude=external --exclude=libs --exclude=node --exclude='src/*.o' --exclude='src/*/*.o' \
    /Users/cell/claude/ionpower-node/ "$HOST:$REMOTE/"

echo "=== [$HOST/$ARCH] scp Makefile + process.cpp (gremlin workaround) ==="
scp /Users/cell/claude/ionpower-node/Makefile                     "$HOST:$REMOTE/Makefile"
scp /Users/cell/claude/ionpower-node/src/node_compat/process.cpp  "$HOST:$REMOTE/src/node_compat/process.cpp"

echo "=== [$HOST/$ARCH] clean + build  (MOZJS=$MOZJS CPU='$CPU') ==="
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS clean && $MAKE $MAKE_ARGS 2>&1 | tail -30"

echo "=== [$HOST/$ARCH] test-all ==="
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS test-all 2>&1 | tail -10"

echo "=== [$HOST/$ARCH] install to /opt/ionpower-node-$VERSION ==="
ssh "$HOST" "rm -rf /opt/ionpower-node-$VERSION && cd $REMOTE && $MAKE $MAKE_ARGS install PREFIX=/opt/ionpower-node-$VERSION 2>&1 | tail -15"

echo "=== [$HOST/$ARCH] tarball ==="
ssh "$HOST" "cd /opt && tar czf /tmp/$TARBALL ionpower-node-$VERSION && ls -la /tmp/$TARBALL"

echo "=== [$HOST/$ARCH] DONE ==="
