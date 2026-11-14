#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SRC="$ROOT/packages/tweaks/src/scripts"
WINDOWS="$ROOT/apps/windows/src/UniVerseProjectBrowser/ContentScripts"
ANDROID="$ROOT/apps/android/browser/src/main/assets/universe-browser"

sync_one() {
  src="$1"
  dest="$2"
  sed -e 's/universe/nook/g' -e 's/Universe/Nook/g' -e 's/UNIVERSE/NOOK/g' "$SRC/$src" > "$dest"
  if grep -qi "niverse" "$dest"; then
    echo "sync-tweak-scripts: $dest still mentions universe after the rename" >&2
    exit 1
  fi
  echo "synced $src -> ${dest#$ROOT/}"
}

if [ "${1:-}" = "--help" ]; then
  echo "usage: scripts/sync-tweak-scripts.sh"
  echo "Copy the shared page scripts from packages/tweaks/src/scripts into the"
  echo "Windows and Android trees, which still embed their own copies."
  echo "The Windows and Android hosts still use the nook names"
  echo "(__nookSponsorBlock, nookSponsorBlock, NOOK_DOWNLOAD_SITES,"
  echo "nookSocialImageDownload, nook-social-video-url), so the copy renames"
  echo "the universe identifiers back to nook on the way out. The rename is"
  echo "mechanical and behaviour-preserving: the shared scripts only use those"
  echo "names for their own globals, handlers, events and element ids."
  echo "Files with no shared counterpart (Windows: nook-cosmetic and the"
  echo "sponsored blockers; Android: night-shade, page-look, readable-content)"
  echo "are not touched. Edit packages/tweaks/src/scripts and re-run this"
  echo "script; never edit the consumer copies by hand. Also regenerates"
  echo "packages/tweaks/src/scriptSources.ts, the macOS embedded copy."
  exit 0
fi

sync_one youtube-sponsorblock.js "$WINDOWS/youtube-sponsorblock.js"
sync_one youtube-sponsorblock.js "$ANDROID/sponsorblock.js"
sync_one youtube-tweaks.js "$WINDOWS/youtube-tweaks.js"
sync_one youtube-tweaks.js "$ANDROID/youtube-tweaks.js"
sync_one social-image-download.js "$WINDOWS/social-image-download.js"
sync_one social-video-source.js "$WINDOWS/social-video-source.js"
node "$ROOT/packages/tweaks/scripts/generate-sources.mjs"
