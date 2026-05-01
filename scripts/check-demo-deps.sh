#!/bin/bash
#
# check-demo-deps — static audit that the install rule's
# DEMO_VENDOR_* lists cover everything the demos transitively reach
# inside test/vendor/.
#
# Catches the two failure modes that bit us during v0.85:
#
#   1. statuses.js  → require('./codes.json')   (sibling JSON not shipped)
#   2. on-finished.js → require('./ee-first.js') (sibling JS not shipped)
#
# Algorithm:
#
#   1. Ask the Makefile for the four shipped lists (FILES, JSON, DIRS,
#      NMDIRS). Build the "shipped at test/vendor/ root" basename set.
#   2. Seed a needed-set with:
#       a. Every test/vendor/ path the demos `require()`.
#       b. Every test/vendor/X.{js,json} that any shim under
#          DEMO_VENDOR_DIRS walks up to via `require(__dirname + '...' )`.
#   3. Closure walk: for each .js in needed-set, scan for relative
#      `require('./Y[.js|.json]')` and add Y to needed-set if Y exists
#      at test/vendor/. Repeat until stable.
#   4. needed ⊆ shipped. Print missing entries; exit 1 on mismatch.
#
# Note: the closure check skips files inside DEMO_VENDOR_DIRS (e.g.
# express/) and DEMO_VENDOR_NM_DIRS (e.g. nm/node_modules/xml2js/) —
# those are shipped recursively by `cp -r`, so their internal relative
# requires are automatically covered as long as the source tree is
# self-consistent. The check is *only* about test/vendor/ root.
#
# Doesn't catch: bare-name requires from inside a vendored lib that
# fall through to a Node-style node_modules lookup we don't ship
# (e.g. `require('on-finished')` from a deep-nested file). We don't
# have that pattern today; if a future vendored package starts doing
# it, this script needs an extension.
#
# Exits 0 on success, 1 on mismatch, 2 on script error.

set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(dirname "$script_dir")"
cd "$repo_root"

if [ ! -d demos ] || [ ! -d test/vendor ]; then
    echo "Error: $repo_root doesn't look like the repo root" >&2
    exit 2
fi

# ------------------------------------------------------------ Makefile lists
shipped_raw=$(make -s print-demo-deps 2>/dev/null) || {
    echo "Error: \`make print-demo-deps\` failed" >&2
    exit 2
}
files_raw=$(echo  "$shipped_raw" | sed -n 's/^FILES: *//p')
json_raw=$(echo   "$shipped_raw" | sed -n 's/^JSON: *//p')
dirs_raw=$(echo   "$shipped_raw" | sed -n 's/^DIRS: *//p')
nmdirs_raw=$(echo "$shipped_raw" | sed -n 's/^NMDIRS: *//p')

tmp=$(mktemp -d)
trap 'rm -rf $tmp' EXIT

# Shipped basenames at test/vendor/ root.
shipped_root="$tmp/shipped_root"
{ echo "$files_raw"; echo "$json_raw"; } | tr ' ' '\n' | grep -v '^$' | sort -u > "$shipped_root"

# ----------------------------------------------------- helpers + seed phase

# Resolve a path fragment to a file at test/vendor/.
# Tries the literal name, then .js, then .json. Skips directories
# (covered by DIRS/NMDIRS) and absent paths.
resolve() {
    local p="$1"
    if [ -d "test/vendor/$p" ]; then return 1; fi
    if [ -f "test/vendor/$p" ]; then echo "$p"; return 0; fi
    if [ -f "test/vendor/$p.js" ]; then echo "$p.js"; return 0; fi
    if [ -f "test/vendor/$p.json" ]; then echo "$p.json"; return 0; fi
    return 1
}

needed="$tmp/needed"
> "$needed"

# ---- Seed 1: demos require ../../test/vendor/X (any depth) ----
demo_seed_raw="$tmp/demo_seed_raw"
find demos -name '*.js' -type f -print0 \
    | xargs -0 grep -hoE "require\\([^)]*test/vendor/[^)\"']+" 2>/dev/null \
    | sed -E "s/.*test\/vendor\/([^\"' )]+).*/\1/" \
    | sort -u > "$demo_seed_raw"

while IFS= read -r p; do
    [ -z "$p" ] && continue
    # If multi-segment (e.g. nm/node_modules/xml2js/lib/xml2js.js),
    # require it to exist as-is — no closure check inside subtree, just
    # existence. Top-level dir must be a covered dir/nmdir.
    case "$p" in
        */*)
            if [ -e "test/vendor/$p" ]; then
                top="${p%%/*}"
                covered=0
                for d in $dirs_raw $nmdirs_raw; do
                    [ "$top" = "$d" ] && covered=1 && break
                done
                # Also accept the nm/node_modules/<x>/... pattern for nmdirs
                if [ "$covered" = "0" ] && [ "$top" = "nm" ]; then
                    second=$(echo "$p" | cut -d/ -f3)
                    for d in $nmdirs_raw; do
                        [ "$second" = "$d" ] && covered=1 && break
                    done
                fi
                if [ "$covered" = "0" ]; then
                    echo "MULTI:$p" >> "$needed"
                fi
            else
                echo "MISSING:$p" >> "$needed"
            fi
            ;;
        *)
            if r=$(resolve "$p"); then
                echo "$r" >> "$needed"
            fi
            # If resolve fails (e.g. 'express' is a dir), it's covered
            # by DEMO_VENDOR_DIRS — silently OK.
            ;;
    esac
done < "$demo_seed_raw"

# ---- Seed 2: shim targets inside DEMO_VENDOR_DIRS ----
# Pattern: `require(__dirname + '...' + 'Y.js')` or just
# `require(__dirname + '/../../../Y.js')`. Either way, the .js
# basename ends up in the require-arg string.
shim_seed="$tmp/shim_seed"
> "$shim_seed"
for d in $dirs_raw; do
    [ -z "$d" ] && continue
    [ ! -d "test/vendor/$d" ] && continue
    find "test/vendor/$d" -type f -name '*.js' -print0 \
        | xargs -0 grep -lE 'require\(__dirname' 2>/dev/null \
        | while IFS= read -r shim; do
            grep -hE 'require\(__dirname' "$shim" \
                | grep -oE "['\"][^'\"]+\\.(js|json)['\"]" \
                | tr -d "'\"" \
                | while IFS= read -r raw; do
                    base=$(basename "$raw")
                    if r=$(resolve "$base"); then echo "$r" >> "$shim_seed"; fi
                done
        done
done
sort -u "$shim_seed" >> "$needed"

# Move to "queue" (no MULTI/MISSING markers — those get reported separately)
queue="$tmp/queue"
grep -v '^MULTI:' "$needed" | grep -v '^MISSING:' | sort -u > "$queue"

# ----------------------------------------------------------- closure walk

# Cap iterations defensively in case of a pathological cycle.
for i in 1 2 3 4 5 6 7 8 9 10; do
    nbefore=$(wc -l < "$queue" | tr -d ' ')
    new="$tmp/new"
    > "$new"
    while IFS= read -r p; do
        case "$p" in *.js) ;; *) continue ;; esac
        [ ! -f "test/vendor/$p" ] && continue
        grep -hoE "require\\(['\"]\\./[^'\"]+['\"]" "test/vendor/$p" 2>/dev/null \
            | sed -E "s/require\\(['\"]\\.\\/([^'\"]+)['\"]/\1/" \
            | while IFS= read -r sub; do
                if r=$(resolve "$sub"); then echo "$r" >> "$new"; fi
            done
    done < "$queue"
    cat "$new" >> "$queue"
    sort -u "$queue" -o "$queue"
    nafter=$(wc -l < "$queue" | tr -d ' ')
    [ "$nbefore" = "$nafter" ] && break
done

# ---------------------------------------------------------------- compare

# Files in needed but not shipped at test/vendor/ root:
missing=$(comm -23 "$queue" "$shipped_root")
multi_unsupported=$(grep '^MULTI:' "$needed" | sed 's/^MULTI://' || true)
absent=$(grep '^MISSING:' "$needed" | sed 's/^MISSING://' || true)

problems=0

if [ -n "$missing" ]; then
    problems=$((problems + 1))
    echo "FAIL: test/vendor/*.{js,json} reached by demos, but NOT shipped:" >&2
    echo "$missing" | sed 's/^/    /' >&2
    echo >&2
    echo "Add each to DEMO_VENDOR_FILES (.js) or DEMO_VENDOR_JSON (.json) in Makefile." >&2
    echo >&2
fi

if [ -n "$multi_unsupported" ]; then
    problems=$((problems + 1))
    echo "FAIL: demos require sub-paths whose top-level dir isn't in DEMO_VENDOR_DIRS or DEMO_VENDOR_NM_DIRS:" >&2
    echo "$multi_unsupported" | sed 's/^/    test\/vendor\//' >&2
    echo >&2
fi

if [ -n "$absent" ]; then
    problems=$((problems + 1))
    echo "FAIL: demos require test/vendor/ paths that don't exist in the source tree:" >&2
    echo "$absent" | sed 's/^/    test\/vendor\//' >&2
    echo >&2
fi

if [ "$problems" = "0" ]; then
    n=$(wc -l < "$queue" | tr -d ' ')
    n_shipped=$(wc -l < "$shipped_root" | tr -d ' ')
    echo "ok: $n test/vendor/ files transitively reached by demos, all in install rule ($n_shipped shipped at root)"
    exit 0
fi

exit 1
