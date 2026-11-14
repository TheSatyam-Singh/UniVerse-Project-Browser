# Content scripts

Four files in this folder are generated from the shared port in
`packages/tweaks/src/scripts/` by `scripts/sync-tweak-scripts.sh`; never edit
them here. The script renames the shared `universe` identifiers back to
`nook` on the way out, because the Windows host still uses the `nook` names
(`__nookSponsorBlock`, the `nookSponsorBlock` / `nookSocialImageDownload`
WebView2 shims in `Services/ContentScriptService.cs`,
`NOOK_DOWNLOAD_SITES`, `nook-social-video-url`). The other four files are
vendored Nook copies, as below. Everything here is GPL-3.0, like the rest of
this project as distributed.

Generated from `packages/tweaks`:

- `youtube-sponsorblock.js` — from `youtube-sponsorblock.js`. Talks to
  `sponsor.ajay.app`; the native side fetches segments and calls
  `window.__nookSponsorBlock.receiveSegments(...)`. Its `window.webkit`
  message-handler calls are bridged to WebView2 by the shim in
  `Services/ContentScriptService.cs`.
- `youtube-tweaks.js` — from `youtube-tweaks.js`. The file is an IIFE that
  takes a config argument; `ContentScriptService` appends the call with
  `{ css, frameThumbnails, noHoverPreview }`, exactly as Nook's
  `YouTubeTweaks.swift` does.
- `social-image-download.js` — from `social-image-download.js`. Needs
  `const NOOK_DOWNLOAD_SITES = [...]` defined before it;
  `ContentScriptService` prepends it from Settings.
- `social-video-source.js` — from `social-video-source.js`.

Vendored from Nook (`Nook-develop/Packages/NookBlocker/Sources/NookBlocker/Resources/`):

- `nook-cosmetic.js` — `NookBlocker/Resources/nook-cosmetic.js`. Reads
  `window.__nookCosmeticConfig` (`{ css: [...] }`), which
  `ContentScriptService` builds from the compiled filter lists. Its
  `nookAdvancedBlocking` subframe lookup is WebKit-only and does not run on
  WebView2; cosmetic hiding on v1 applies to main frames.
- `facebook-sponsored-blocker.js` — `NookBlocker/Resources/facebook-sponsored-blocker.js`.
- `instagram-sponsored-blocker.js` — `NookBlocker/Resources/instagram-sponsored-blocker.js`.
- `twitter-ad-blocker.js` — `NookBlocker/Resources/twitter-ad-blocker.js`.

Identifiers inside the generated files still say `nook`
(`__nookSponsorBlockLoaded`, `[NookSB]`, `nookSponsorBlock`). That is
deliberate: the hosts still call those names. The day the hosts move to the
`universe` names, the sync script can copy verbatim. The feed-prune variants
(`facebook-feed-prune.js`, `instagram-feed-prune.js`) and
`nook-stealth-redirects.js` are not vendored: the prune scripts are
alternatives to the sponsored blockers already included, and the redirect
table is generated from the filter lists by Nook's `build-redirects.mjs`,
which has no Windows equivalent yet.
