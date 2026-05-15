#!/bin/sh
# survey-one.sh PKG [SPEC]
# - PKG is the install spec, e.g. "lodash" or "chalk@^4"
# - SPEC (optional) is the JS identifier used in require(), default = bare PKG
#   stripped of any "@version" tail. Override when the npm name and the
#   require-name differ.
#
# Run on G3 from /Users/macuser/tmp/survey-047/. Each invocation creates
# a fresh per-package dir under ./pkgs/, npm-installs the package, and
# runs a tiny require-and-poke script. Captures stdout+stderr to
# ./logs/<pkg>.log and a one-line summary to ./summary.tsv.

set -u

PKG="$1"
INSTALL_SPEC="$PKG"
# strip @version tail to get bare name
BARE=$(echo "$PKG" | sed 's/@[^@]*$//')
[ "$BARE" = "" ] && BARE="$PKG"
REQUIRE_NAME="${2:-$BARE}"

BASE=/Users/macuser/tmp/survey-047
RUNTIME=/Users/macuser/tmp/ionpower-node/node
NPM_WRAPPER=/Users/macuser/tmp/npm-6.14.18/run-npm.js
# Point the runtime at the vendored babel.js so the parse-failure fallback
# can lower ES2018+ syntax (object spread, etc.). This mirrors what a
# tarball install does via <PREFIX>/share/ionpower-node/vendor/babel.js,
# which we don't have under /Users/macuser/tmp/ionpower-node/ (raw git tree).
export IONPOWER_BABEL_PATH=/Users/macuser/tmp/ionpower-node/test/vendor/babel.js
LOG_DIR="$BASE/logs"
PKG_DIR="$BASE/pkgs/$BARE"

mkdir -p "$LOG_DIR" "$PKG_DIR"
LOG="$LOG_DIR/$BARE.log"

# Slug for summary.tsv
SLUG=$(echo "$BARE" | tr '/' '_')

(
    echo "=== survey-one.sh PKG=$PKG REQUIRE=$REQUIRE_NAME ==="
    date
    echo

    cd "$PKG_DIR" || exit 71
    cat > package.json <<EOF
{
  "name": "survey-$SLUG",
  "version": "0.0.1",
  "private": true
}
EOF

    echo "--- npm install $INSTALL_SPEC ---"
    T0=$(date +%s)
    "$RUNTIME" "$NPM_WRAPPER" install "$INSTALL_SPEC" 2>&1
    INSTALL_RC=$?
    T1=$(date +%s)
    echo "--- install exit=$INSTALL_RC dt=$((T1-T0))s ---"
    echo

    if [ $INSTALL_RC -ne 0 ]; then
        printf "%s\tINSTALL_FAIL\t%s\t-\n" "$BARE" "exit$INSTALL_RC" >> "$BASE/summary.tsv"
        echo "INSTALL_FAIL — aborting"
        exit $INSTALL_RC
    fi

    # Build a require test
    cat > _require_test.js <<EOF
try {
    var m = require('$REQUIRE_NAME');
    var t = typeof m;
    var keys = (t === 'object' && m !== null) ? Object.keys(m).slice(0, 8) : null;
    var fnName = (t === 'function') ? (m.name || '(anonymous)') : null;
    console.log('REQUIRE_OK typeof=' + t
        + (fnName ? ' fnName=' + fnName : '')
        + (keys ? ' first_keys=' + JSON.stringify(keys) : '')
    );
} catch (e) {
    console.log('REQUIRE_FAIL ' + (e && e.message ? e.message : e));
    if (e && e.stack) {
        console.log(String(e.stack).split('\n').slice(0, 5).join('\n'));
    }
    process.exit(2);
}
EOF

    echo "--- require('$REQUIRE_NAME') ---"
    T0=$(date +%s)
    "$RUNTIME" _require_test.js 2>&1
    REQ_RC=$?
    T1=$(date +%s)
    echo "--- require exit=$REQ_RC dt=$((T1-T0))s ---"

    if [ $REQ_RC -eq 0 ]; then
        printf "%s\tOK\tinstall_ok\trequire_ok\n" "$BARE" >> "$BASE/summary.tsv"
    else
        printf "%s\tREQUIRE_FAIL\tinstall_ok\texit%d\n" "$BARE" "$REQ_RC" >> "$BASE/summary.tsv"
    fi
    exit $REQ_RC
) 2>&1 | tee "$LOG"
