# UniVerse Project Browser for Windows (Route B)

A thin WinUI 3 shell hosting Microsoft Edge WebView2, running the real
UniVerse browser UI (the `packages/demo` Vite + react-native-web build)
extended with Windows shims. The engine is WebView2: per-tab WebView2
instances are positioned by the native shell over the UI's tab surface and
driven through a host object that implements the `ac_engine.h` call/event
shape (one JSON-in / JSON-out call plus an event sink).

## Layout

- `Universe.Windows/` — the WinUI 3 app (unpackaged, runnable with F5).
  `MainWindow` hosts the UI WebView2 and the tab WebView2s on a Canvas.
  `TabHost` owns the tabs, the engine-call dispatch and the in-memory
  history log. `EngineBridge` is the COM-visible host object exposed to
  the UI as `window.chrome.webview.hostObjects.universeEngine`.
- `Universe.Windows.Package/` — the MSIX packaging project
  (`Package.appxmanifest`, logos). Build it for a distributable `.msix`.
- `Universe.Windows/Assets/WebUI/` — build output of the Windows web UI
  (`pnpm --filter @universe/demo run build:windows`). Do not edit by hand.
- `packages/demo/src/windows/` — the Windows side of the web UI: the
  host-object bridge (`hostObject.ts`, `engineBridge.ts`), the Windows tab
  surface (`WebView.windows.tsx`), and the Windows shim variants
  (`universecore.windows.tsx`, `shell.windows.tsx`). The Windows Vite
  config is `packages/demo/vite.windows.config.ts`.

## How the UI talks to the shell

- UI to shell, request/response: `universeEngine.engineCall(domain, name,
  profile, argsJson)` returns a JSON string; `createTab`, `navigate`,
  `goBack`, `goForward`, `reload`, `stop`, `setTabVisible`, `setMuted`,
  `zoomStep`, `evaluate`, `navigationEntries`, `getSecurityInfo`.
- UI to shell, fire-and-forget: `window.chrome.webview.postMessage` with
  `{ kind: "tab-rect", tabId, x, y, width, height }` from a ResizeObserver
  on the tab surface.
- Shell to UI: `CoreWebView2.PostWebMessageAsJson` with `tab-navigation`,
  `tab-progress`, `tab-favicon`, `tab-crashed`, `tab-load-error`, and
  `engine-event` messages.
- Outside the shell (a plain browser) the Windows web UI falls back to the
  demo behaviour: engine calls use the demo stubs and tabs render in
  iframes, so the same build is testable without Windows.

## Build on Windows

Prerequisites: Windows 10 17763+ or Windows 11, Visual Studio 2022 with
the .NET desktop and WinUI workloads, .NET 8 SDK, Node 24, pnpm 11.
The Evergreen WebView2 Runtime ships with Windows 11; on Windows 10
install it from Microsoft if the app reports it missing.

```powershell
.\build.ps1 -Configuration Release -Platform x64
```

This builds the web UI, the app, and the MSIX package (unsigned; pass
`-Sign` with a certificate thumbprint for a signed package). Run the app
from Visual Studio (F5) or install the `.msix` from
`Universe.Windows.Package\AppPackages\`.

## What works in this step (end of Phase 2)

One window, the real UniVerse UI, one tab browsing real sites through
WebView2: navigate, back/forward, reload, progress, title, favicon,
history (in-memory, this session only), and the engine calls the UI needs
at startup. Widevine comes free with WebView2, so protected media plays.

## Known gaps (Phase 3)

- No persistent history, bookmarks, passwords, or sync store yet: the
  shell keeps history in memory only, bookmarks return an empty tree, and
  the remaining engine calls throw the same "not on Windows yet" error the
  web demo uses, which the UI already tolerates.
- No downloads, content blocking, find-in-page, print, PiP, or DevTools
  wiring yet; those WebView2 APIs exist and are the next increment.
- `zoomStep` is a no-op until the shell drives the WebView2 zoom factor.
- `systemInfo` reports placeholder values; the shell should serve the real
  app version through the host object.
- No updater yet (MSIX auto-update replaces Sparkle on Windows) and no
  code-signing certificate (EV or Azure Trusted Signing) is configured.
- The C# shell has not been compiled: there is no .NET toolchain on the
  Linux VM this was written on. The first `dotnet build` on a Windows
  machine (or the `windows-latest` CI loop) is the next verification step.
