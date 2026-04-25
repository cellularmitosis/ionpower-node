#!/bin/bash
# G4 triad build — no --delete (emac's rsync 2.6.3 doesn't grok --delete-before)
set -e
HOST=emac
ARCH=g4
REMOTE=/Users/macuser/tmp/ionpower-node
VERSION=0.23
TARBALL=ionpower-node-${VERSION}-${ARCH}-ppc.tar.gz
MOZJS=/opt/mozjs-45-ionpower-g4
CPU='-mcpu=7450 -mtune=7450'
MAKE=make
MAKE_ARGS="MOZJS_PREFIX=$MOZJS CPU_FLAGS=\"$CPU\""

echo "=== [$HOST/$ARCH] rsync source (no --delete) ==="
~/bin/tiger-rsync.sh \
    --exclude=.git --exclude=external --exclude=libs --exclude=node --exclude='src/*.o' --exclude='src/*/*.o' \
    /Users/cell/claude/ionpower-node/ "$HOST:$REMOTE/"

echo "=== [$HOST/$ARCH] scp Makefile + process.cpp ==="
scp /Users/cell/claude/ionpower-node/Makefile                     "$HOST:$REMOTE/Makefile"
scp /Users/cell/claude/ionpower-node/src/node_compat/process.cpp  "$HOST:$REMOTE/src/node_compat/process.cpp"

echo "=== [$HOST/$ARCH] clean + build ==="
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS clean && $MAKE $MAKE_ARGS 2>&1 | tail -30"

echo "=== [$HOST/$ARCH] test-all ==="
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS test-all 2>&1 | tail -10"

echo "=== [$HOST/$ARCH] install ==="
ssh "$HOST" "rm -rf /opt/ionpower-node-$VERSION && cd $REMOTE && $MAKE $MAKE_ARGS install PREFIX=/opt/ionpower-node-$VERSION 2>&1 | tail -15"

echo "=== [$HOST/$ARCH] tarball ==="
ssh "$HOST" "cd /opt && tar czf /tmp/$TARBALL ionpower-node-$VERSION && ls -la /tmp/$TARBALL"

echo "=== [$HOST/$ARCH] DONE ==="
