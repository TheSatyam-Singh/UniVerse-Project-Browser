# UniVerse Project Browser for Android

A native Kotlin and Jetpack Compose browser for Android phones. The full
architecture, module map and shared-code rules live in `docs/android.md` at
the repo root; this file only records what changed in Phase 4 and what a
release build needs.

## Page engine

The production engine is the **Android System WebView**
(`browser/.../SystemWebViewEngine.kt`), behind the `PageEngine` interface
(`browser/.../PageEngine.kt`). System WebView was chosen over GeckoView
(bigger APK, its own update channel) and over building Chromium for Android
(not feasible in CI). A GeckoView engine can replace `SystemWebViewEngine`
without the screens changing: nothing outside `:browser` sees what is behind
`PageEngine`, and `PageEngine.isDevelopmentOnly` stays as the seam marker.

## Nook ports (Phase 4)

- **Tab archive + multi-select.** Archive and auto-archive already lived in
  `:store` (`TabStore`) and `:tabs` (`ArchiveView`); Phase 4 added the
  missing half, multi-select: selection state in `TabDeckModel`, bulk
  archive/delete in `AppModel`, long-press a tab card and pick Select Tab
  (or tap cards while selecting), with a selection bar for Archive, Delete
  and Done. Closing a regular tab archives it; private tabs are closed.
- **SponsorBlock + YouTube tweaks.** Nook's content scripts are reused
  verbatim in `browser/src/main/assets/universe-browser/` (`sponsorblock.js`,
  `youtube-tweaks.js`). `SponsorBlock.kt` fetches segments from the
  SponsorBlock hash-prefix API (`https://sponsor.ajay.app/api`), keeps
  Nook's category defaults (sponsor auto-skips, highlight manual, the rest
  off) and delivers them to the script with
  `window.__nookSponsorBlock?.receiveSegments(...)`. Injection happens in
  `WebViewPage` on page finish and on history updates (YouTube is a SPA),
  never in private pages. Settings live in `BrowsingSettings`
  (`sponsorBlockEnabled`, per-site override in `SiteSettings.sponsorBlock`,
  `youTubeHideShorts`, `youTubeFrameThumbnails`, `youTubeNoHoverPreview`);
  toggles are in Settings › Site Settings and, for the current site, in the
  page menu on YouTube pages.
- **Filter lists.** The `:blocking` catalog already carried Nook's whole list
  set (EasyList, EasyPrivacy, Peter Lowe's, uBlock filters/unbreak/badware/
  privacy/quick-fixes, URLhaus, AdGuard URL tracking). The one gap was that
  AdGuard URL tracking (`adguard-spyware-url`, the `$removeparam` list) was
  off by default; it is on by default now, matching Nook for new installs.
- **Tidy Downloads.** A deterministic port of Nook's `DownloadTidier` gate
  (`DownloadTidier.kt`): automatic-folder, non-private network downloads
  whose names look machine-made (hash, UUID, long digits, generic words,
  copy counters) are renamed from the page title. Nook names files with the
  on-device language model (macOS 26); Android has no equivalent, so the
  title-derived name replaces the model call. Off by default; Settings ›
  Site Settings › Tidy Downloads.
- **Per-site settings.** Already existed (zoom, Night Shade, app links,
  desktop site, blockers off per host in `SiteSettings`); Phase 4 added the
  per-site SponsorBlock override on top.
- **Link previews.** Long-press a link and pick Preview. `LinkPreview.kt`
  ports Nook's gate (no private pages, http(s) only, no loopback/private/
  link-local hosts, DNS checked before fetching) and its regex extractor
  (title, description, Open Graph image, site name, lead paragraphs). The
  fetch is capped at 512 KB and follows at most 5 redirects, each re-gated.
  Nook summarises the page with the on-device model; Android shows the
  description or lead text instead, with Open to open the link.
- **Deep links.** `universe://` was already registered (manifest intent
  filter + `SystemLink`): `open`, `search`, `tab`, `voice`, `incognito`,
  `mac-tabs`. Nook's `space` action has no Android target (Android shows
  synced Mac spaces read-only), so it was not added.

## Shared TypeScript bridge

`packages/core` (omnibox input→URL, suggestions, bangs, clean URLs) already
runs on Android through Hermes; Phase 4 added no new bridge code because
the seam was complete:

- `shared/ScriptEngine.kt` loads the `universe-core.hbc` bundle (built from
  `packages/core/src/mobile.ts`, same source as the iPhone app) and exposes
  synchronous `__host` functions plus `call`/`callAsync` with JSON
  arguments.
- `store/HermesCoreScript.kt` + `store/Omnibox.kt` expose the core
  functions to Kotlin: `mobileSuggest`, `mobileResolve`, `mobileClean`,
  `mobileDisplay`, `mobileEngines`, `mobileSetSearch`, `mobileSetSources`,
  `mobileWarmBangs`, `mobileLoadBangDocument`, `mobileSuggestRequest`,
  `mobileParseRemote`. A rule the shared TypeScript has is called through
  `ScriptEngine`, never rewritten in Kotlin.
- The bundle build (hermesc, integrity-checked, `-O
  -Xes6-block-scoping`) is documented in `docs/android.md`. One leftover
  rebrand: the JS global is still named `ArdiaCore` (`SharedScript.CORE`);
  it is internal only, but a rename should ride along with the next bundle
  change.

## Release signing

`app/build.gradle.kts` signs the release build only when all four secrets
are present, as environment variables (CI) or Gradle properties
(`-P` / `gradle.properties`, never committed):

| Secret | Meaning |
|---|---|
| `UNIVERSE_RELEASE_STORE_FILE` / `universe.release.storeFile` | Path to the release keystore (`.jks`) |
| `UNIVERSE_RELEASE_STORE_PASSWORD` / `universe.release.storePassword` | Keystore password |
| `UNIVERSE_RELEASE_KEY_ALIAS` / `universe.release.keyAlias` | Key alias inside the keystore |
| `UNIVERSE_RELEASE_KEY_PASSWORD` / `universe.release.keyPassword` | Key password |

Without them the build stays unsigned (`assembleRelease` still works, as
CI needs) — signing is skipped, not failed. The keystore and any
`keystore.properties` must never be committed: `*.jks`, `*.keystore` and
`keystore.properties` are in `apps/android/.gitignore`.

To sign a release locally, generate a keystore once with
`keytool -genkeypair -keystore universe-release.jks -alias universe
-keyalg RSA -keysize 2048 -validity 10000`, keep the file and its
passwords outside the repo (for example in the password manager), and run:

```
UNIVERSE_RELEASE_STORE_FILE=/path/to/universe-release.jks \
UNIVERSE_RELEASE_STORE_PASSWORD=... \
UNIVERSE_RELEASE_KEY_ALIAS=universe \
UNIVERSE_RELEASE_KEY_PASSWORD=... \
./gradlew :app:assembleRelease
```

CI still needs a workflow step that writes the keystore from a GitHub
secret and sets these four variables before `:app:assembleRelease`
(see `RUN_LOG-phase4.md`); `.github/workflows/android.yml` is outside
`apps/android/` and was not edited here.

## Verification

No Java/Android SDK exists on this Linux VM, so nothing here was built or
run. Before merging, run on CI or a machine with the SDK:

```
./gradlew assembleDebug testDebugUnitTest :app:assembleRelease
```
