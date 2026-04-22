#!/bin/bash
# Deploy ionpower-node sources to imacg52, build, run smoke tests.
# Run this *after* /opt/mozjs-45-ionpower/ is populated on imacg52.
set -e
HOST="${HOST:-imacg52}"
REMOTE_DIR="${REMOTE_DIR:-/Users/macuser/tmp/ionpower-node}"

echo "[1] rsync source to $HOST:$REMOTE_DIR/"
~/bin/tiger-rsync.sh --delete \
    --exclude=.git --exclude=external --exclude=libs \
    /Users/cell/claude/ionpower-node/ "$HOST:$REMOTE_DIR/"

echo "[2] confirm mozjs install is present"
ssh "$HOST" "cd $REMOTE_DIR && make check-mozjs"

echo "[3] compile ionpower-node"
ssh "$HOST" "cd $REMOTE_DIR && make 2>&1 | tail -50"

echo "[4] run hello.js"
ssh "$HOST" "cd $REMOTE_DIR && ./ionpower-node test/hello.js"

echo "[5] run require_chain.js"
ssh "$HOST" "cd $REMOTE_DIR && ./ionpower-node test/require_chain.js"

echo "[6] run fs_smoke.js"
ssh "$HOST" "cd $REMOTE_DIR && ./ionpower-node test/fs_smoke.js"

echo "[7] verify JIT (stock js shell)"
ssh "$HOST" "/opt/mozjs-45-ionpower/bin/js --ion-eager $REMOTE_DIR/test/verify_jit.js"
ssh "$HOST" "/opt/mozjs-45-ionpower/bin/js --no-ion --no-baseline $REMOTE_DIR/test/verify_jit.js"

echo "[done]"
