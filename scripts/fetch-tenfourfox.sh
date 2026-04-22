#!/bin/bash
# Populate external/tenfourfox/ with the sparse subset of Classilla's
# TenFourFox tree that our build needs. Idempotent: safe to re-run.
#
# The sparse paths below were discovered iteratively during the Phase 1
# build (see docs/build-notes.md for the story). Anything you drop here
# will break a later build step silently — expand cautiously.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$REPO_ROOT/external/tenfourfox"

SPARSE_PATHS=(
    js/src js/public js/xpconnect
    mfbt mozglue nsprpub memory
    build config python
    testing/mozbase
    layout/tools/reftest
    dom/bindings
    other-licenses/ply
    xpcom/idl-parser
    toolkit
    configure.in configure client.mk Makefile.in moz.build aclocal.m4
)

if [ ! -d "$DST/.git" ]; then
    mkdir -p "$DST"
    git -C "$DST" init -q
    git -C "$DST" remote add origin https://github.com/classilla/tenfourfox.git
    git -C "$DST" config core.sparseCheckout true
    git -C "$DST" config core.sparseCheckoutCone false
    # Pin to the HEAD we validated against.
    git -C "$DST" fetch --depth 1 --filter=blob:none origin 51ec6270e2872da493b2c66497c05dc1659eadb9 -q
fi

git -C "$DST" sparse-checkout set --skip-checks "${SPARSE_PATHS[@]}"
git -C "$DST" checkout 51ec6270e2872da493b2c66497c05dc1659eadb9 -q

echo "ok: external/tenfourfox at $(git -C "$DST" rev-parse --short HEAD)"
echo "size: $(du -sh "$DST" | awk '{print $1}')"
