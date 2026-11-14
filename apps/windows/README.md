# UniVerse Project Browser — Windows shell

WinUI 3 (C#) shell hosting WebView2 (Edge's Chromium). This is the Windows side
of the merged browser: macOS keeps Ardia's Chromium + React Native shell,
Android keeps its Kotlin app, and Windows gets this shell. There was no Windows
code in either codebase before this; everything under `apps/windows/` is new.

## Status

Written and tree-checked on Linux; **never built or run**. There is no MSVC or
Windows SDK on this machine, and `windows-latest` CI is the first place this
can actually compile. `scripts/check-windows-tree.py` verifies the tree is
consistent (solution GUIDs, every file the `.csproj` lists, manifest assets,
XAML code-behind classes, content scripts) but it cannot typecheck C# or XAML.
Treat the first green `universe-windows.yml` run as the real verification.

## The react-native-windows decision: native WinUI 3 for v1

The plan (MERGE_PLAN.md §5.4) preferred reusing the React Native UI via
react-native-windows, falling back to a native WinUI shell if that proved too
heavy or could not be expressed cleanly without a Windows machine to test
against. **v1 takes the fallback: a native WinUI 3 shell with a XAML sidebar
replicating Ardia's layout.** The reasons:

- react-native-windows 0.81 does exist and matches the repo's React Native
  0.81.6, so the version alignment is not the problem. The problem is the app
  around it: `apps/browser` is an **Expo ~54 + react-native-macos** app. Expo
  does not run on Windows, and the macOS app depends on macOS-only native
  modules (`packages/shell` iOS/Swift modules, Metal shaders in
  `packages/shaders`, `react-native-macos` itself). A Windows RN app would need
  a second entry point, a second Metro config, stubs for every Expo and
  macOS-only module, and a C++/WinRT TurboModule bridge for the WebView2 host —
  all of it unverifiable without a Windows machine.
- The RNW toolchain itself is fragile right now: RNW 0.81.3 shipped to npm
  with its matching NuGet package missing, and a Windows App SDK 1.7.x patch
  broke RNW builds at the linker. Betting the first Windows build on that
  coupling, blind, is how v1 never ships.
- The native shell is small, self-contained, and buildable by the CI workflow
  as written. The sidebar, tabs, profiles and address bar are XAML controls
  driven by view models that mirror Ardia's state domains
  (`state/tabs`, `state/profiles`, `state/pins`, `state/sidebar`), so the
  behaviour matches even though the rendering does not share code.

The RNW path is not closed: if the browser app is ever split into a
platform-agnostic entry point (Expo and macOS-only modules behind an
interface), the WinUI shell can host a `ReactNativeWindow` and the XAML
sidebar becomes a thin host. Until then, the XAML sidebar is the UI.

## Layout

```
apps/windows/
  UniVerseProjectBrowser.sln
  src/UniVerseProjectBrowser/
    UniVerseProjectBrowser.csproj   .NET 8, WinUI 3, single-project MSIX
    Package.appxmanifest            com.universe.projectbrowser, universe:// scheme
    app.manifest                    DPI awareness, long paths, UTF-8
    App.xaml / App.xaml.cs          entry point, shared view model, updater start
    MainWindow.xaml / .cs           sidebar + title bar + split-pane host
    Controls/
      SidebarView.xaml / .cs       profiles row, address bar, pinned grid, tab list
      AddressBarView.xaml / .cs    omnibox input (Enter commits, Esc restores)
      BrowserPaneView.xaml / .cs   hosts one WebView2 per pane; rebuilds it on
                                   profile change (one WebView2 environment per profile)
    ViewModels/
      ViewModelBase.cs              INotifyPropertyChanged helper
      TabViewModel.cs               TabViewModel + ProfileViewModel
      BrowserViewModel.cs           SidebarViewModel, PaneViewModel, BrowserViewModel
    Services/
      SettingsService.cs            LocalSettings keys (blocking, SponsorBlock, tweaks, sync, updates)
      OmniboxService.cs             input → URL / search; tracking-param stripping
      FilterEngine.cs               ABP-style rule parser + matcher
      FilterListService.cs          shared catalog, download, cache, refresh
      ContentBlockingService.cs     WebResourceRequested interception
      ContentScriptService.cs       AddScriptToExecuteOnDocumentCreated wiring
      SponsorBlockService.cs        sponsor.ajay.app client + JS delivery
      BrowserEngine.cs              WebView2 host: navigation, messages, downloads
      SyncService.cs                folder-sync plumbing (see below)
      UpdateService.cs              WinSparkle via P/Invoke
      DeepLinkService.cs            universe:// open / search / space
    ContentScripts/                 vendored Nook JS (see ContentScripts/README.md)
    Assets/                         placeholder icons (indigo "U"); replace with the
                                    real brand icon from apps/site/src/assets/app-icon.png
    Properties/PublishProfiles/win-x64.pubxml
  scripts/
    check-windows-tree.py           tree validation, run by CI before the build
    refresh-filter-lists.ps1        dev-time snapshot refresh (Nook script analogue)
```

## Engine and profiles

WebView2 uses the evergreen Edge runtime — no Chromium build, no bundled
engine. Each profile gets its own WebView2 user-data folder
(`%LocalAppData%\UniVerseProjectBrowser\WebView2\<profileId>`), which is what
gives profiles separate logins and cookies, mirroring Ardia's per-profile
isolation. Switching to a tab from another profile rebuilds the pane's WebView2
with that profile's folder; same-profile tab switches reuse the control.

Split view holds up to 3 panes (side-by-side or stacked, toggled once 3 panes
exist). `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+L` focus address bar,
`Ctrl+R` reload, `Ctrl+Shift+N` new window. Windows are separate
`BrowserViewModel` instances; `universe://` links always go to the first
window's view model.

## Ad blocking: request interception, same lists, no duplicated data

macOS has full uBlock Origin; WebView2 has no extension APIs, so v1
re-implements uBlock-style blocking in `Services/`:

- `FilterListService` loads the **shared catalog** — it does not copy it. The
  `.csproj` links
  `apps/android/blocking/src/main/resources/.../FilterListCatalog.json` into the
  package as `FilterLists\FilterListCatalog.json`, the same catalog Android
  already uses. At runtime the service downloads the enabled lists
  (`off == false` in the catalog: uBlock filters/badware/privacy/unbreak/
  quick-fixes, EasyList, EasyPrivacy, URLhaus, Peter Lowe's) from the catalog's
  mirror URLs into `%LocalAppData%\UniVerseProjectBrowser\FilterLists\`,
  honouring `updateAfter` and the lists' own `! Expires:` headers. No list
  data ships in the package.
- `FilterEngine` parses ABP-style rules: `||domain^` exact-host rules go into
  hash sets (the common case — the vast majority of network rules), the rest
  become lazy-compiled wildcard regexes (capped at 2,000 cached), `@@`
  exceptions win over blocks, `domain=` / `third-party` / resource-type
  options are honoured, `$removeparam` rules are collected, and `##selector`
  cosmetic rules are collected separately. Scriptlets (`#$#`) are skipped and
  counted. This is a v1 matcher, not adblock-rust: it is deliberately close to
  Android's `FilterEngine`/`NetworkMatcher` shape so a faster port can replace
  it later.
- `ContentBlockingService` registers
  `AddWebResourceRequestedFilter("*", All)` and answers blocked requests with
  an empty 403. Third-party is computed against the top document's host
  (suffix comparison, no PSL — the same approximation as the omnibox host
  check; `packages/core/src/tlds.ts` has the real list).
- `$removeparam` and the `packages/core/src/cleanUrl.ts` tracking-param tables
  are applied to top-level navigations (`NavigationStarting` cancels and
  re-navigates to the cleaned URL) and to omnibox input. Subresource query
  rewriting is not possible through `WebResourceRequested` (a replaced response
  serves content, it does not re-request), so `$removeparam` on subresources
  is not applied on v1.
- If no lists can be downloaded (offline first run), the engine falls back to
  a small built-in seed of well-known ad/tracker domains (from Android's
  `SeedRules.kt`, trimmed). Cosmetic hiding uses the generic `##selector`
  rules as `window.__nookCosmeticConfig`; per-host selectors are injected on
  navigation. Subframe cosmetics do not work on v1 (Nook's
  `nookAdvancedBlocking` lookup needs a WebKit message handler that returns a
  promise; `chrome.webview.postMessage` is fire-and-forget).

## Content scripts and SponsorBlock

`packages/tweaks` does not exist yet, so the content scripts are vendored
verbatim from Nook under `ContentScripts/` (see `ContentScripts/README.md` for
the per-file source list). `ContentScriptService` registers them with
`AddScriptToExecuteOnDocumentCreatedAsync`, in this order:

1. A WebKit-compat shim defining `window.webkit.messageHandlers` for
   `nookSponsorBlock` and `nookSocialImageDownload`, bridged to
   `chrome.webview.postMessage` (the vendored scripts call the WebKit handler;
   the shim makes them work unmodified on WebView2).
2. The cosmetic config script (`window.__nookCosmeticConfig`), then
   `nook-cosmetic.js` (all pages).
3. `youtube-sponsorblock.js` + `youtube-tweaks.js`, wrapped in a YouTube
   hostname guard; the tweaks call is appended with `{ css,
   frameThumbnails, noHoverPreview }` exactly as Nook's `YouTubeTweaks.swift`
   does. Hide-Shorts CSS uses Nook's literal selectors (the two home/search
   shelf selectors interpolate Nook's `YouTubeHomeSection.shorts` fragment and
   are omitted until `packages/tweaks` lands).
4. `social-image-download.js` (preceded by `const NOOK_DOWNLOAD_SITES = [...]`
   from Settings), `social-video-source.js`, and the Facebook / Instagram /
   Twitter sponsored blockers, each wrapped in a hostname guard — the
   blockers have no hostname guard of their own and must not run on every
   page.

`SponsorBlockService` mirrors Nook's `SponsorBlockManager`: it fetches
`GET https://sponsor.ajay.app/api/skipSegments/<sha256-prefix-4>?categories=[...]`
(the hash-prefix lookup, so the full video ID never leaves the machine in the
URL), matches the full-hash entry, and delivers the segments to the page via
`window.__nookSponsorBlock.receiveSegments(segments, options)`. Segments are
cached in memory for one hour. Social download requests from the page are
saved to the user's Downloads folder.

## Extensions: none on WebView2 v1

**No Chrome Web Store extensions on WebView2 v1. WebView2 has no extension
APIs.** There is no way to load a Chrome extension into a WebView2 control,
so the Windows build ships without extensions entirely — no extension UI, no
extension sync, no "Add to UniVerse" button. What v1 does instead:

- Ad blocking is re-implemented as request interception above (same filter
  lists as macOS/Android).
- Site tweaks (SponsorBlock, YouTube/Facebook tweaks, social downloads) are
  content scripts, which WebView2 does support.
- Sync uses `packages/sync` folder sync instead of Chrome sync (below).

If extensions ever come to Windows, the realistic paths are CEF (partial
extension support, C++ shell, and the RN UI does not plug in) or a full
Chromium build — both are out of scope for v1 (see MERGE_PLAN.md §5.4).

## Sync: folder sync, unencrypted v1

`SyncService` implements the `packages/sync` folder-sync shape: the user picks
a folder (OneDrive, Dropbox, local folder), the service watches it for
`*.json` record changes, and it reads/writes records with the same field names
as `packages/sync/src/records.ts` (`DeviceTabs`, bookmarks, history). **v1
writes records unencrypted and marks them
`universeWindowsV1Unencrypted: true`.** The E2E encryption in
`packages/sync/src/canon.ts` / `hlc.ts` is not ported yet, so **do not point
v1 Windows sync at a folder shared with macOS sync** — the macOS side would
see records it cannot decrypt-verify, and the Windows side cannot read
encrypted records. Sync is off by default (`SyncEnabled = false`) until the
crypto port lands.

## Packaging and updates: MSIX + WinSparkle

- **Packaging:** single-project MSIX (no separate `.wapproj`). `dotnet
  publish` with `WindowsPackageType=MSIX` produces the `.msix`; the same
  publish output zipped is the portable fallback. The manifest identity is
  `com.universe.projectbrowser`, version `0.2.47.0`, min Windows 10 1809
  (17763), target 19041, x64 + ARM64.
- **Updater: WinSparkle.** Chosen over MSIX/Store auto-update because v1
  builds are unsigned, and MSIX auto-update needs a signed package plus a
  trusted certificate or the Store. WinSparkle is Sparkle's Windows sibling and
  reads the same appcast format macOS Sparkle uses, so the release process
  stays one feed family. `UpdateService` P/Invokes `WinSparkle.dll` from the
  official `WinSparkle` 0.9.4 NuGet package; if the DLL is absent the updater
  silently disables itself instead of crashing. The default feed is
  `https://github.com/TheSatyam-Singh/UniVerse-Project-Browser/releases/latest/download/appcast-windows.xml`
  — **that feed does not exist yet**. The release workflow must publish
  `appcast-windows.xml` alongside the MSIX (the macOS side already publishes
  `appcast.xml` via `check-sparkle.sh`; the Windows feed is the same shape).
  EdDSA verification needs a key: set `UpdateEdDSAPublicKey` once the new
  brand's Sparkle key exists (MERGE_PLAN.md §5.5 — no Apple/EdDSA secrets
  exist for the new brand yet). Until then WinSparkle checks an unsigned feed,
  which is the same posture as an unsigned MSIX.

## Deep links

`universe://` is registered in the manifest and handled by
`DeepLinkService`: `universe://open?url=&space=`, `universe://search?q=`,
`universe://space?name=`, mirroring Nook's `nook://` scheme.

## Building

On Windows, with .NET 8 SDK + Windows 10 SDK 10.0.19041.0 (both on
`windows-latest` runners):

```powershell
dotnet restore apps/windows/UniVerseProjectBrowser.sln
dotnet build apps/windows/UniVerseProjectBrowser.sln -c Release -p:Platform=x64
dotnet publish apps/windows/src/UniVerseProjectBrowser/UniVerseProjectBrowser.csproj -c Release -r win-x64 --self-contained -p:WindowsPackageType=MSIX -p:AppxPackageSigningEnabled=false
```

`pnpm install --frozen-lockfile` at the repo root is a CI prerequisite (the
workflow runs it so the shared TS packages are present for future steps; the
C# build itself needs only NuGet). Signing is optional: set the
`WINDOWS_CERT_PFX_BASE64` (+ `WINDOWS_CERT_PASSWORD`) repository secrets and
CI signs the MSIX with `signtool`; without them the build stays unsigned and
still uploads both artifacts.

## Known gaps (v1, not bugs to file separately)

- No extensions (see above). No Chrome sync (folder sync instead).
- No find-in-page (WebView2 has no stable Find API in the WinUI control
  surface used here), no per-site zoom persistence beyond
  `CoreWebView2.ZoomFactor`, no DevTools UI (DevTools opens via
  `CoreWebView2.OpenDevToolsWindow`, not wired to a menu yet).
- No tab freezing/sleep, no Recently Cleaned sweep, no tab groups — the
  sidebar mirrors Ardia's layout, not its full tab state machine.
- No telemetry: the repo's telemetry pipeline (`apps/browser/src/state/telemetry`,
  `apps/cli`) has no Windows sink yet; nothing is measured on Windows until
  one is added. Counts/timings must never include URLs, titles, or page
  content, per the repo's consent model.
- Cosmetic hiding is main-frame only; subframe `$removeparam` is not applied;
  the `||domain^` fast path ignores rules that also carry `domain=` /
  resource-type / third-party options (those fall through to the regex list).
- The `windows-cert.pfx` file is written to the working directory by CI only
  when the secret exists and is deleted in the same step.
- Placeholder icons: replace `Assets/*.png` with the real brand icon before
  any public release.
