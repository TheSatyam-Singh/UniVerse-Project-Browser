# @universe/ai

The AI assistant ported from Nook (`Nook/Managers/AIManager/`, `Nook/Managers/TabOrganizerManager/`,
`Nook/Managers/DevMCPServer/`), re-implemented as pure TypeScript against Ardia's seams. It fills
Ardia's 59 deferred AI parity rows and is deliberately the last Phase 3 item: it depends on the
tab/page APIs and must not block the browser itself.

## What lives here

- `providers.ts` — provider abstraction plus HTTP clients for Gemini, Ollama, OpenAI-compatible
  and OpenRouter. Apple Intelligence is a gate, not an implementation: it reports availability
  from the injected `PlatformInfo` and throws `unsupported_feature` elsewhere, because the
  on-device model is only reachable through the macOS shell's Foundation Models bridge
  (macOS 26+).
- `tools.ts` — the 12 browser-tool definitions from Nook's `BrowserTools`, plus the read-only
  and mutating sets the approval rules use.
- `pageScripts.ts` — the page JavaScript from Nook's `BrowserToolExecutor`, as string builders,
  plus the untrusted-content wrapper and page-context formatting from `AIService`.
- `toolExecutor.ts` — runs tool calls against a `PageBridge`. The bridge is an interface the app
  implements from its own state (`apps/browser/src/state/ai/aiBridge.ts`): tab tools are wired to
  the real store, and page tools run through the mounted WebView handle
  (`platform/webviews.ts`, `WebViewHandle.evaluate` from `packages/universecore`).
- `service.ts` — the agentic loop from `AIService`: provider factory, page context, at most 20
  tool iterations, approval gating (read-only tools auto-run in ask mode, mutating tools prompt,
  MCP tools always prompt per server, `executeJavaScript` always prompts, nothing runs in a
  private window).
- `config.ts` — the persisted configuration shape from `AIConfigService`. API keys are never part
  of it: they live behind the `AiKeyStore` interface (Keychain on macOS; the app ships an
  in-memory store until the shell provides one). Nothing in this package logs a key.
- `mcp.ts` — the MCP client, manager and transports from Nook's `MCPClient`/`MCPManager`/
  `MCPTransport`: JSON-RPC 2.0, `initialize`, `tools/list`, `tools/call`, a 30 s request timeout,
  stdio (spawned child process, allow-listed environment) and SSE (HTTPS required off localhost).
- `devMcpServer.ts` — the local MCP server for coding agents from Nook's `DevMCPServer`:
  streamable-HTTP JSON-RPC on `127.0.0.1:47823`, bearer token from a `0600` file, tools for
  listing tabs, opening/navigating, reading a page, evaluating JavaScript and downloading into
  `~/Downloads/UniVerse MCP`. The path guard from `DevMCPFiles` is ported: writes stay under
  that root and `..` is refused. The shell starts it only when `browserControlServerEnabled`
  is on; the Windows shell does not start it yet.
- `tabOrganizer.ts` — the plan model from Nook's `TabOrganizationPlan`/`TabOrganizationModel`:
  duplicate detection (same page ignoring scheme, `www.` and trailing slash), the folder-name
  rules (generic names dropped, one-tab folders dropped), title shortening, and a rules-based
  classifier (same registrable domain plus shared title words) that runs everywhere. The
  provider-based classifier (`classifyWithProvider`) asks the configured AI provider for JSON
  groups and sanitises the answer with the same rules. The Apple Intelligence classifier runs
  only on macOS 26+; elsewhere the rules classifier is the fallback until a cross-platform
  classifier exists.

## Keys

Keys come from the user's settings only, through `AiKeyStore`. They are never committed,
printed, logged, or stored in the JSON config. `stripSecretsFromConfig` deep-copies the config
for persistence, and the config parser drops any `apiKey` field it finds in saved data.

## Tests

`node --test src/*.test.mjs` — the tests import the TypeScript sources directly, the same
pattern `packages/tweaks` uses.
