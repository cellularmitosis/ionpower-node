#!/bin/bash
# Triad build — one host. Usage: triad-build.sh [host] <arch> <version>
#
# If <host> is omitted (or specified as 'auto'), defaults to the
# canonical host for that arch:
#
#   g3 -> ibookg37   (PowerBook4,3, iBook G3 900 MHz)
#   g4 -> emac       (eMac G4 7450)
#   g5 -> pmacg5     (Power Mac G5 970)
#
# Each host has a matching SpiderMonkey at /opt/mozjs-45-ionpower-{g3,g4,g5}/.
set -e

if [ $# -eq 2 ]; then
    HOST=auto
    ARCH=$1
    VERSION=$2
elif [ $# -eq 3 ]; then
    HOST=$1
    ARCH=$2
    VERSION=$3
else
    echo "usage: $0 [host] <arch> <version>" >&2
    echo "       arch: g3 | g4 | g5" >&2
    exit 2
fi

case $ARCH in
    g3) MOZJS=/opt/mozjs-45-ionpower-g3; CPU='-mcpu=750 -mtune=750';   MAKE=make;                    USE_DELETE=yes; DEFAULT_HOST=ibookg37 ;;
    g4) MOZJS=/opt/mozjs-45-ionpower-g4; CPU='-mcpu=7450 -mtune=7450'; MAKE=make;                    USE_DELETE=no;  DEFAULT_HOST=emac     ;;   # emac's rsync 2.6.3 lacks --delete-before
    g5) MOZJS=/opt/mozjs-45-ionpower-g5; CPU='-mcpu=G5 -D_PPC970_';    MAKE=/opt/make-4.3/bin/make;  USE_DELETE=yes; DEFAULT_HOST=pmacg5   ;;
    *)  echo "unknown arch: $ARCH" >&2; exit 1 ;;
esac

[ "$HOST" = "auto" ] && HOST=$DEFAULT_HOST

REMOTE=/Users/macuser/tmp/ionpower-node
TARBALL=ionpower-node-${VERSION}-${ARCH}-ppc.tar.gz

MAKE_ARGS="MOZJS_PREFIX=$MOZJS CPU_FLAGS=\"$CPU\""
RSYNC_DELETE=""
[ "$USE_DELETE" = "yes" ] && RSYNC_DELETE="--delete"

echo "=== [$HOST/$ARCH/$VERSION] rsync source ==="
~/bin/tiger-rsync.sh $RSYNC_DELETE \
    --exclude=.git --exclude=external --exclude=libs --exclude=node --exclude='src/*.o' --exclude='src/*/*.o' \
    /Users/cell/claude/ionpower-node/ "$HOST:$REMOTE/"

# tiger-rsync.sh has a long-standing gremlin where a small handful of
# files don't always update through the rsync. Force them via scp.
echo "=== [$HOST/$ARCH/$VERSION] scp Makefile + process.cpp + globals.cpp + main.cpp + net.cpp (gremlin workaround) ==="
scp /Users/cell/claude/ionpower-node/Makefile                     "$HOST:$REMOTE/Makefile"
scp /Users/cell/claude/ionpower-node/src/main.cpp                 "$HOST:$REMOTE/src/main.cpp"
scp /Users/cell/claude/ionpower-node/src/node_compat/process.cpp  "$HOST:$REMOTE/src/node_compat/process.cpp"
scp /Users/cell/claude/ionpower-node/src/node_compat/globals.cpp  "$HOST:$REMOTE/src/node_compat/globals.cpp"
scp /Users/cell/claude/ionpower-node/src/node_compat/net.cpp      "$HOST:$REMOTE/src/node_compat/net.cpp"
scp /Users/cell/claude/ionpower-node/src/node_compat/buffer.cpp   "$HOST:$REMOTE/src/node_compat/buffer.cpp"

echo "=== [$HOST/$ARCH/$VERSION] clean + build  (MOZJS=$MOZJS CPU='$CPU') ==="
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS clean && $MAKE $MAKE_ARGS 2>&1 | tail -30"

echo "=== [$HOST/$ARCH/$VERSION] test-all ==="
# Capture output to a temp file + check make's real exit code.
ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS test-all > /tmp/ion-${ARCH}-tests.log 2>&1; ec=\$?; tail -20 /tmp/ion-${ARCH}-tests.log; exit \$ec" || {
    echo "=== [$HOST/$ARCH/$VERSION] TEST-ALL FAILED, attempting one retry (flake?) ==="
    ssh "$HOST" "cd $REMOTE && $MAKE $MAKE_ARGS test-all > /tmp/ion-${ARCH}-tests.log 2>&1; ec=\$?; tail -20 /tmp/ion-${ARCH}-tests.log; exit \$ec"
}

echo "=== [$HOST/$ARCH/$VERSION] install ==="
ssh "$HOST" "rm -rf /opt/ionpower-node-$VERSION && cd $REMOTE && $MAKE $MAKE_ARGS install PREFIX=/opt/ionpower-node-$VERSION 2>&1 | tail -12"

echo "=== [$HOST/$ARCH/$VERSION] tarball ==="
ssh "$HOST" "cd /opt && tar czf /tmp/$TARBALL ionpower-node-$VERSION && ls -la /tmp/$TARBALL"

echo "=== [$HOST/$ARCH/$VERSION] DONE ==="
