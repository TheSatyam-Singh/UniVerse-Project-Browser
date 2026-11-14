#!/bin/bash
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../../../.." && pwd)
S=${FIXES_SCRATCH:-$HOME/universe-scratch/release-0244}
mkdir -p "$S/before" "$S/after" "$S/cli/before" "$S/cli/after"
for side in before after; do
  v=$([ "$side" = before ] && echo 0.2.43 || echo 0.2.44)
  if [ ! -d "$S/$side/UniVerse-Project-Browser.app" ]; then
    ditto "$REPO/dist/$v/export/UniVerse-Project-Browser.app" "$S/$side/UniVerse-Project-Browser.app"
    codesign --force --deep --sign - "$S/$side/UniVerse-Project-Browser.app" >/dev/null 2>&1
  fi
  if [ ! -x "$S/cli/$side/bin/universe" ]; then
    tar xzf "$REPO/dist/$v/universe-cli-$v-macos-arm64.tar.gz" -C "$S/cli/$side" --strip-components 1
  fi
done
node "$REPO/apps/videos/scripts/fixes/sessions-release-0244.mjs" "$S"
if ! lsof -nP -iTCP:47231 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup node "$REPO/apps/videos/scripts/capture/sites/serve.mjs" 47231 >"$S/serve.log" 2>&1 &
  echo $! >"$S/serve.pid"
fi
echo "ready in $S"
