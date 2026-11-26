export type NavigationStateMessage = {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  faviconUri: string | null;
  themeColor: string | null;
  httpStatus?: number;
};

export type ShellMessage =
  | { kind: "engine-event"; domain: string; name: string; data: unknown }
  | { kind: "tab-navigation"; tabId: string; state: NavigationStateMessage }
  | { kind: "tab-progress"; tabId: string; progress: number }
  | { kind: "tab-favicon"; tabId: string; uri: string }
  | { kind: "tab-crashed"; tabId: string; reason: string }
  | { kind: "tab-load-error"; tabId: string; url: string; code: number; message: string };

export type UiToShellMessage = {
  kind: "tab-rect";
  tabId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface UniverseEngineHostObject {
  engineCall(domain: string, name: string, profile: string, argsJson: string): Promise<string>;
  createTab(tabId: string, profile: string): Promise<string>;
  destroyTab(tabId: string): Promise<void>;
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  stop(tabId: string): Promise<void>;
  setTabVisible(tabId: string, visible: boolean): Promise<void>;
  setMuted(tabId: string, muted: boolean): Promise<void>;
  zoomStep(tabId: string, direction: number): Promise<void>;
  evaluate(tabId: string, code: string): Promise<string>;
  navigationEntries(tabId: string): Promise<string>;
  getSecurityInfo(tabId: string): Promise<string>;
}

export interface ChromeWebView {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  hostObjects: { universeEngine?: UniverseEngineHostObject };
}

declare global {
  interface Window {
    chrome?: { webview?: ChromeWebView };
  }
}

const SHELL_MESSAGE_KINDS = new Set(["engine-event", "tab-navigation", "tab-progress", "tab-favicon", "tab-crashed", "tab-load-error"]);

export function webview(): ChromeWebView | null {
  if (typeof window === "undefined") return null;
  return window.chrome?.webview ?? null;
}

export function hostObject(): UniverseEngineHostObject | null {
  return webview()?.hostObjects?.universeEngine ?? null;
}

export function isWindowsShell(): boolean {
  return hostObject() !== null;
}

export function postToShell(message: UiToShellMessage): void {
  webview()?.postMessage(message);
}

export function onShellMessage(listener: (message: ShellMessage) => void): () => void {
  const view = webview();
  if (!view) return () => {};
  const handler = (event: { data: unknown }) => {
    const data = event.data as Partial<ShellMessage> | null;
    if (!data || typeof data.kind !== "string" || !SHELL_MESSAGE_KINDS.has(data.kind)) return;
    listener(data as ShellMessage);
  };
  view.addEventListener("message", handler);
  return () => view.removeEventListener("message", handler);
}
