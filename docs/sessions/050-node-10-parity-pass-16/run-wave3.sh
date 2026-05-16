#!/bin/sh
# run-wave3.sh — iterate wave-3 candidate list through survey-one.sh
# Run on G3 from /Users/macuser/tmp/survey-050/.
# Reads ./wave3-list.txt; calls ./survey-one.sh PKG [REQUIRE_NAME].
# Writes ./summary.tsv (one row per package) and ./progress.tsv
# (one row per attempt with timing).

set -u

BASE=/Users/macuser/tmp/survey-050
LIST="$BASE/wave3-list.txt"
PROGRESS="$BASE/progress.tsv"

cd "$BASE" || { echo "FATAL: no $BASE"; exit 1; }

echo "=== run-wave3.sh starting $(date) ==="
echo "PID=$$"
COUNT=0
while IFS= read -r line; do
    case "$line" in
        ''|\#*) continue ;;
    esac

    SPEC=$(echo "$line" | awk '{print $1}')
    REQ=$(echo "$line" | awk '{print $2}')

    COUNT=$((COUNT + 1))
    BARE=$(echo "$SPEC" | sed 's/@[^@]*$//')
    [ "$BARE" = "" ] && BARE="$SPEC"

    echo
    echo "=== [$COUNT] $SPEC (require=${REQ:-$BARE}) at $(date) ==="
    T0=$(date +%s)

    if [ -n "$REQ" ]; then
        ./survey-one.sh "$SPEC" "$REQ" >/dev/null 2>&1
    else
        ./survey-one.sh "$SPEC" >/dev/null 2>&1
    fi
    RC=$?
    T1=$(date +%s)
    DT=$((T1 - T0))
    printf "%s\t%s\t%s\t%ds\n" "$BARE" "$SPEC" "$RC" "$DT" >> "$PROGRESS"
    echo "    exit=$RC dt=${DT}s (log: logs/$BARE.log)"
done < "$LIST"

echo
echo "=== run-wave3.sh done $(date) ==="
echo "Summary:"
cat "$BASE/summary.tsv"
