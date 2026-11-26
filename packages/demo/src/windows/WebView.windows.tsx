import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import type { NavigationEntry, NavigationState, SecurityInfo, WebViewHandle, WebViewProps } from "@universe-real/universecore";
import { hostObject, isWindowsShell, onShellMessage, postToShell } from "./hostObject";
import { WebView as DemoWebView } from "../shims/web/WebView";

const done = Promise.resolve();

const WindowsTabSurface = forwardRef<WebViewHandle, WebViewProps>(function WindowsTabSurface(props, ref) {
  const latest = useRef(props);
  latest.current = props;
  const surface = useRef<HTMLDivElement | null>(null);
  const tabId = props.tabId ?? "";
  const created = useRef(false);
  const favicon = useRef<string | null>(null);

  useEffect(() => {
    const host = hostObject();
    if (!host || !tabId || created.current) return;
    created.current = true;
    let cancelled = false;
    void host.createTab(tabId, props.profile ?? "").then(() => {
      if (cancelled) return;
      latest.current.onReady?.();
      if (props.url) void host.navigate(tabId, props.url);
    });
    return () => {
      cancelled = true;
      created.current = false;
      void host.destroyTab(tabId);
    };
  }, [tabId]);

  useEffect(() => {
    const node = surface.current;
    if (!node || !tabId) return;
    const report = () => {
      const rect = node.getBoundingClientRect();
      postToShell({ kind: "tab-rect", tabId, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    window.addEventListener("resize", report);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [tabId]);

  useEffect(() => {
    const host = hostObject();
    if (!host || !tabId) return;
    void host.setTabVisible(tabId, props.visible !== false);
  }, [tabId, props.visible]);

  useEffect(() => {
    if (!tabId) return;
    return onShellMessage((message) => {
      if (message.kind === "engine-event" || message.tabId !== tabId) return;
      if (message.kind === "tab-navigation") {
        const state = message.state;
        favicon.current = state.faviconUri;
        const nav: NavigationState = {
          url: state.url,
          title: state.title,
          canGoBack: state.canGoBack,
          canGoForward: state.canGoForward,
          isLoading: state.isLoading,
          themeColor: state.themeColor,
          themeColorSource: state.themeColor ? "meta" : null,
          httpStatus: state.httpStatus,
        };
        latest.current.onNavigationChange?.(nav);
        return;
      }
      if (message.kind === "tab-progress") {
        latest.current.onProgress?.(message.progress);
        return;
      }
      if (message.kind === "tab-favicon") {
        favicon.current = message.uri;
        latest.current.onFavicon?.(message.uri, [message.uri]);
        return;
      }
      if (message.kind === "tab-crashed") {
        const reason = message.reason === "abnormal" || message.reason === "killed" || message.reason === "crashed" || message.reason === "oom" || message.reason === "launchFailed" || message.reason === "integrity" ? message.reason : "unknown";
        latest.current.onCrashed?.({ status: -1, reason, code: 0 });
        return;
      }
      if (message.kind === "tab-load-error") {
        latest.current.onLoadError?.({ url: message.url, code: message.code, text: message.message });
      }
    });
  }, [tabId]);

  useImperativeHandle(ref, () => {
    const host = () => hostObject();
    const handle: Partial<WebViewHandle> = {
      nativeTag: () => null,
      loadUrl: async (url) => {
        await host()?.navigate(tabId, url);
      },
      goBack: async () => {
        await host()?.goBack(tabId);
      },
      goForward: async () => {
        await host()?.goForward(tabId);
      },
      reload: async () => {
        await host()?.reload(tabId);
      },
      forceReload: async () => {
        await host()?.reload(tabId);
      },
      stopLoading: async () => {
        await host()?.stop(tabId);
      },
      setMuted: async (muted) => {
        await host()?.setMuted(tabId, muted);
      },
      zoomStep: async (direction) => {
        await host()?.zoomStep(tabId, direction);
      },
      evaluate: async <T,>(code: string): Promise<T | null> => {
        const json = await host()?.evaluate(tabId, code);
        if (!json) return null;
        try {
          return JSON.parse(json) as T;
        } catch {
          return null;
        }
      },
      navigationEntries: async () => {
        const json = await host()?.navigationEntries(tabId);
        if (!json) return [];
        try {
          return JSON.parse(json) as NavigationEntry[];
        } catch {
          return [];
        }
      },
      getSecurityInfo: async () => {
        const json = await host()?.getSecurityInfo(tabId);
        if (!json) return null;
        try {
          return JSON.parse(json) as SecurityInfo;
        } catch {
          return null;
        }
      },
      downloadFavicon: async () => (favicon.current ? { uri: favicon.current, width: 32, height: 32 } : null),
      discard: async () => "unsupported",
    };
    return new Proxy(handle, { get: (target, key) => (key in target ? target[key as keyof WebViewHandle] : () => done) }) as WebViewHandle;
  }, [tabId]);

  const visible = props.visible !== false;
  return (
    <View style={[props.style, { overflow: "hidden", backgroundColor: "#FFFFFF" }, !visible && { opacity: 0, pointerEvents: "none" }]}>
      <div ref={surface} style={{ position: "absolute", inset: 0 }} />
    </View>
  );
});

export const WebView = forwardRef<WebViewHandle, WebViewProps>(function WindowsWebView(props, ref) {
  if (!isWindowsShell()) return <DemoWebView {...props} ref={ref} />;
  return <WindowsTabSurface {...props} ref={ref} />;
});
