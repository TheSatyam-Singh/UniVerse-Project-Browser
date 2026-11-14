#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "--help" ]; then
  echo "usage: refresh-filter-lists.sh [--check]"
  echo "Downloads the bundled filter-list snapshots into packages/universecore/vendor/filter-lists."
  echo "With --check, reports which lists are missing or stale and exits 1 when any are."
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/packages/universecore/vendor/filter-lists"
mkdir -p "$DEST"
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

LISTS=(
  "easylist.txt|https://easylist.to/easylist/easylist.txt|100000|10000000"
  "easyprivacy.txt|https://easylist.to/easylist/easyprivacy.txt|50000|5000000"
  "peter-lowes.txt|https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext|10000|2000000"
  "ublock-filters.min.txt|https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt|50000|5000000"
  "ublock-unbreak.txt|https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt|5000|2000000"
  "ublock-badware.txt|https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt|5000|2000000"
  "ublock-privacy.min.txt|https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt|5000|2000000"
  "ublock-quick-fixes.txt|https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt|1000|2000000"
  "adguard-url-tracking.txt|https://filters.adtidy.org/extension/ublock/filters/17.txt|20000|5000000"
  "urlhaus-filter.txt|https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt|10000|30000000"
)

stale=0
for entry in "${LISTS[@]}"; do
  name="${entry%%|*}"
  rest="${entry#*|}"
  url="${rest%%|*}"
  rest="${rest#*|}"
  min="${rest%%|*}"
  max="${rest#*|}"
  if [ "$CHECK" = 1 ]; then
    if [ ! -s "$DEST/$name" ]; then
      echo "refresh-filter-lists: $name missing"
      stale=1
    fi
    continue
  fi
  tmp="$(mktemp)"
  curl -sfL --max-time 90 "$url" -o "$tmp"
  size="$(wc -c < "$tmp")"
  first="$(grep -m1 -v '^[[:space:]]*$' "$tmp" || true)"
  if [ "$size" -lt "$min" ] || [ "$size" -gt "$max" ] || ! [[ "$first" == "["* || "$first" == "!"* || "$first" == "#"* ]]; then
    echo "refresh-filter-lists: $name looks wrong (size $size, first line: ${first:0:40}); keeping old copy" >&2
    rm -f "$tmp"
    continue
  fi
  mv "$tmp" "$DEST/$name"
  echo "$name $(wc -c < "$DEST/$name") bytes"
done

if [ "$CHECK" = 1 ] && [ "$stale" = 1 ]; then
  exit 1
fi
exit 0
