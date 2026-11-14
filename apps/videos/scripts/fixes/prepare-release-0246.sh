#!/bin/bash
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../../../.." && pwd)
S=${FIXES_SCRATCH:-$HOME/universe-scratch/film-0246}
mkdir -p "$S/before" "$S/after"
for side in before after; do
  dir=$([ "$side" = before ] && echo 0.2.45 || echo 0.2.46-rc)
  if [ ! -d "$S/$side/UniVerse-Project-Browser.app" ]; then
    ditto "$REPO/dist/$dir/export/UniVerse-Project-Browser.app" "$S/$side/UniVerse-Project-Browser.app"
    codesign --force --deep --sign - "$S/$side/UniVerse-Project-Browser.app" >/dev/null 2>&1
  fi
done
for f in sessions-0246n2 sessions-0246n6 sessions-0246n7 sessions-release-0246; do
  node "$REPO/apps/videos/scripts/fixes/$f.mjs" "$S"
done
if ! lsof -nP -iTCP:47231 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup node "$REPO/apps/videos/scripts/capture/sites/serve.mjs" 47231 >"$S/serve.log" 2>&1 &
  echo $! >"$S/serve.pid"
fi
if ! lsof -nP -iTCP:47247 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup node "$REPO/apps/videos/scripts/fixes/scenes/_r46sites.mjs" 47247 >"$S/r46sites.log" 2>&1 &
  echo $! >"$S/r46sites.pid"
fi
echo "ready in $S"
