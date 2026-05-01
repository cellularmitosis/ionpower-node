#!/bin/bash
#
# Find test/*.js files that aren't wired into any test-list-*.txt.
# Excludes a small allowlist of files that are intentionally not run
# under `make test*` (helpers, benchmarks, the stdin-pipe smoke, the
# standalone JIT verifier — see TESTING.md for the rationale).
#
# Exits 0 if everything is accounted for; 1 if there are unexpected
# orphan tests; 2 if invoked from the wrong directory.

set -e

# Locate the repo root from this script's own path (one level up
# from scripts/) so the check works no matter where it's invoked from.
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(dirname "$script_dir")"
cd "$repo_root"

if test ! -d test || test ! -d scripts ; then
    echo "Error: $repo_root doesn't look like the repo root" >&2
    exit 2
fi

# Files in test/*.js that are not run by `make test-all`.
# Keep this list in sync with TESTING.md's "Intentionally excluded"
# section.
allowlist="
test/babel_load_modern.js
test/marked_bench.js
test/stdin_stream_smoke.js
test/verify_jit.js
"

# Build the set of paths covered by test-list-*.
list_files=$(ls scripts/test-list-*.txt 2>/dev/null)
if test -z "$list_files" ; then
    echo "Error: no scripts/test-list-*.txt found" >&2
    exit 2
fi

covered=$(cat $list_files | sort -u)
existing=$(ls test/*.js | sort)
expected_skip=$(echo "$allowlist" | grep . | sort -u)

# Files in test/ but not in any list and not in the allowlist.
orphans=$(comm -23 \
    <(echo "$existing") \
    <(printf '%s\n%s\n' "$covered" "$expected_skip" | sort -u))

if test -z "$orphans" ; then
    n_lists=$(echo "$covered" | wc -l | awk '{print $1}')
    n_skip=$(echo "$expected_skip" | wc -l | awk '{print $1}')
    n_files=$(echo "$existing" | wc -l | awk '{print $1}')
    echo "ok: $n_files files in test/ accounted for"
    echo "    $n_lists wired via scripts/test-list-*.txt"
    echo "    $n_skip in the intentional-skip allowlist"
    exit 0
fi

echo "FAIL: $(echo "$orphans" | wc -l | awk '{print $1}') orphan test file(s) — neither wired into a test-list nor on the intentional-skip allowlist:"
echo
echo "$orphans" | sed 's/^/    /'
echo
echo "Either:"
echo "  - append the path to scripts/test-list-more.txt (or test-list-core.txt for fast core smokes), OR"
echo "  - add it to the allowlist in this script + document why in TESTING.md."

exit 1
