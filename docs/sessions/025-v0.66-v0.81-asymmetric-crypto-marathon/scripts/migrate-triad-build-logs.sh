#!/bin/bash
# Migrate /tmp/triadNN-gX.log -> docs/sessions/<session>/build-logs/v0.NN-gX.log
set -e

map_session() {
    case "$1" in
        24|25|26|27|28|29|30|31|32|33|34|35|36)
                                       echo 2026-04-24-session-v ;;
        37|38|39|40|41|42|43|44|45|46|47|48|49|50)
                                       echo 2026-04-24-session-w ;;
        51|52|53|54|55|56|57|58|59|60|61|62|63|64|65)
                                       echo 2026-04-25-session-x ;;
        *) echo "" ;;
    esac
}

cd /Users/cell/claude/ionpower-node
moved=0
for f in /tmp/triad*-g[345].log; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # Extract NN: triadNN-gX.log -> NN
    nn=$(echo "$base" | sed -E 's/^triad([0-9]+)-g[345]\.log$/\1/')
    if ! [[ "$nn" =~ ^[0-9]+$ ]]; then continue; fi
    arch=$(echo "$base" | sed -E 's/^triad[0-9]+-(g[345])\.log$/\1/')
    sess=$(map_session "$nn")
    if [ -z "$sess" ]; then
        echo "no map for $base (nn=$nn)"
        continue
    fi
    dest="docs/sessions/$sess/build-logs"
    mkdir -p "$dest"
    cp "$f" "$dest/v0.$nn-$arch.log"
    moved=$((moved+1))
done
echo "moved=$moved"
