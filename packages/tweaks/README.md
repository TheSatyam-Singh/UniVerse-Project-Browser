# @universe/tweaks

Site tweaks ported from Nook: SponsorBlock, YouTube / Facebook / Reddit
tweaks, Boosts (per-site styles and scripts), site routing (Air Traffic
Control rules) and the content-script plan that carries them into Chromium.

Nook is WebKit; Ardia is Chromium. This package ports the logic, not the
engine: pure TypeScript plus the page scripts, with no WebKit, AppKit or
Swift dependency. Nothing here touches a web view. The app owns injection.

## Layout

- `src/scripts/*.js` — the page scripts, ported from Nook and renamed from
  the `nook` namespace to `universe` (`__universeSponsorBlock`,
  `__universeFBFilter`, `data-universe-frame`, …). These files are the
  reviewable port; Nook's own code in them is GPL-3.0. They are the single
  source for the Windows and Android copies too:
  `scripts/sync-tweak-scripts.sh` copies them into
  `apps/windows/src/UniVerseProjectBrowser/ContentScripts/` (as
  `youtube-sponsorblock.js`, `youtube-tweaks.js`,
  `social-image-download.js`, `social-video-source.js`) and
  `apps/android/browser/src/main/assets/universe-browser/` (as
  `sponsorblock.js`, `youtube-tweaks.js`), renaming the `universe`
  identifiers back to `nook` on the way out because those hosts still call
  the `nook` names (`window.__nookSponsorBlock.receiveSegments`,
  `NOOK_DOWNLOAD_SITES`). Never edit the consumer copies by hand.
- `src/scriptSources.ts` — the same scripts as importable strings, generated
  from `src/scripts/` by `node scripts/generate-sources.mjs`. Edit the `.js`
  files, then regenerate; never edit the generated file by hand.
- `src/sponsorBlock.ts` — categories, skip options and defaults, the
  hash-prefix API client (only the first 4 hex chars of the video id's
  SHA-256 leave the machine), the 1-hour cache and the segment guard that
  rejects ranges that would skip a video to its end.
- `src/youtubeTweaks.ts`, `src/facebookTweaks.ts`, `src/redditTweaks.ts` —
  the CSS builders and script builders. Facebook's feed prune runs in the
  page world (it hooks the page's own `JSON.parse`); Reddit's Hot sort runs
  there too. Everything else runs isolated.
- `src/boost.ts` — the Boost model: host matching, compiled CSS (visual
  controls first, the user's own CSS last), Zap selectors, the bait rule that
  never hides YouTube's `#player-ads`, and bundle import/export. Imported
  scripts arrive disabled and imported CSS cannot reach the network.
- `src/siteRouting.ts` — domain + optional path-prefix rules to a profile,
  longest domain wins, then longest path. `arcRouteToSiteRule` converts an
  Arc Air Traffic Control route the same way Nook's `arcSiteRules` did.
- `src/oauth.ts` — OAuth/OIDC/SSO URL detection, so a sign-in started by a
  page finishes in that page's profile instead of being routed away.
- `src/settings.ts` — the persisted `TweaksSettings` document (version 1),
  parsed field by field so one bad field never loses the rest.
- `src/contentScripts.ts` — `tweakScriptsFor(url, settings)`: the scripts a
  page gets, each with an id, a source hash, a run time and a world. The host
  installs them and skips reinstalling a script whose hash is unchanged.

## What the host must do

The app (see `apps/browser/src/state/tweaks/`) loads `TweaksSettings`,
calls `tweakScriptsFor` on navigation and installs the result through
Chromium's content-script API, one isolated world for the tweaks plus the
page world for the Facebook and Reddit scripts. Two pairings matter:

- SponsorBlock: the page script defines
  `window.__universeSponsorBlock.receiveSegments`. The host fetches segments
  with `SponsorBlockClient` and evaluates the deliver script in the same
  isolated world the script was installed in, or the page script never sees
  it. Viewed-segment reports go out only from non-private pages.
- Boosts: the host computes `boostCssFor(url, boosts)` and injects the
  result with `boostStyleScript`, which keeps a single
  `#universe-boost-style` element. Boost scripts run once after load, in an
  isolated world with no bridge, and only when the user turned that script
  on. Zap selectors compile to `host##selector` cosmetic-filter lines for
  the content blocker as well as into the injected stylesheet.

## Tests

`node --test src/*.test.mjs` — pure logic, no app, no network (the API
client takes a stubbed fetch). The SponsorBlock hash is checked against
Node's own SHA-256.

## Licensing

The TypeScript in `src/` is UniVerse Project Browser's own code
(Apache-2.0). The page scripts in `src/scripts/` are ported from Nook
(GPL-3.0); each carries that license header, and the app as distributed is
GPL-3.0 because its engine carries Helium's patches (see `NOTICE`).
