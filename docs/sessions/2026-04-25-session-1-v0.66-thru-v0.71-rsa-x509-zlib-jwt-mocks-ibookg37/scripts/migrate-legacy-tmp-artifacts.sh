#!/bin/bash
# Map version -> session-dir using a case statement (works on bash 3 too).
set -e

map_session() {
    case "$1" in
        0.1|0.2)                       echo 2026-04-23-session-d ;;
        0.3|0.4)                       echo 2026-04-23-session-e ;;
        0.5)                           echo 2026-04-23-session-f ;;
        0.6)                           echo 2026-04-23-session-g ;;
        0.7|0.8)                       echo 2026-04-23-session-h ;;
        0.9)                           echo 2026-04-23-session-i ;;
        0.10|0.11)                     echo 2026-04-24-session-j ;;
        0.12)                          echo 2026-04-24-session-k ;;
        0.13)                          echo 2026-04-24-session-m ;;
        0.14)                          echo 2026-04-24-session-n ;;
        0.15|0.16)                     echo 2026-04-24-session-p ;;
        0.17|0.18)                     echo 2026-04-24-session-q ;;
        0.19)                          echo 2026-04-24-session-r ;;
        0.20|0.21)                     echo 2026-04-24-session-s ;;
        0.22|0.23)                     echo 2026-04-24-session-u ;;
        0.24|0.25|0.26|0.27|0.28|0.29|0.30|0.31|0.32|0.33|0.34|0.35|0.36)
                                       echo 2026-04-24-session-v ;;
        0.37|0.38|0.39|0.40|0.41|0.42|0.43|0.44|0.45|0.46|0.47|0.48|0.49|0.50)
                                       echo 2026-04-24-session-w ;;
        0.51|0.52|0.53|0.54|0.55|0.56|0.57|0.58|0.59|0.60|0.61|0.62|0.63|0.64|0.65)
                                       echo 2026-04-25-session-x ;;
        0.66|0.67|0.68|0.69|0.70|0.71)
                                       echo 2026-04-25-session-1-v0.66-thru-v0.71-rsa-x509-zlib-jwt-mocks-ibookg37 ;;
        *) echo "" ;;
    esac
}

cd /Users/cell/claude/ionpower-node
moved=0
skipped=0
for f in /tmp/v0.*-*; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    ver=$(echo "$base" | sed -E 's/^v([0-9]+\.[0-9]+)-.*/\1/')
    [ -z "$ver" ] && { skipped=$((skipped+1)); continue; }
    sess=$(map_session "$ver")
    if [ -z "$sess" ]; then
        echo "no map for $base (ver=$ver)"
        skipped=$((skipped+1))
        continue
    fi
    dest_dir="docs/sessions/$sess/release-notes"
    mkdir -p "$dest_dir"
    cp "$f" "$dest_dir/$base"
    moved=$((moved+1))
done
echo "moved=$moved skipped=$skipped"
