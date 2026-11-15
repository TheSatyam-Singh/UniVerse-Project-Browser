import "./platform/nativeEvents";
import { useEffect, useLayoutEffect, useState } from "react";
import { AppRegistry, unstable_batchedUpdates } from "react-native";
import { WindowRoot } from "./App";
import { DevErrorBoundary } from "./components/window/DevErrorBoundary";
import { startTranslate } from "./state/site/translate";
import { afterFirstWindow, firstWindowCommitted } from "./lib/afterFirstWindow";
import { startAppIntegration } from "./state/app/appIntegration";
import { startCliControl } from "./state/app/cliControl";
import { startAutomation } from "./state/automation/controlSocket";
import { startDevMcp } from "./state/ai/devMcp";
import { startDecideHooks } from "./state/automation/decideHooks";
import { startOpenWhenDone } from "./state/windows/downloadWatch";
import { startUserScripts } from "./state/extensions/userScripts";
import { startKillSwitches } from "./platform/killSwitchesLaunch";
import { startMemoryTrim } from "./state/tabs/memoryTrim";
import { startNativeSync } from "./state/app/nativeSync";
import { startPersistence } from "./state/session/persist";
import { configRestoreSession, startConfigFiles } from "./state/config/configFiles";
import { colorRoles } from "./components/ui/tokens";
import { startFavicons } from "./state/favicons/favicons";
import { startHistory } from "./state/history/engineSync";
import { startBookmarks } from "./state/bookmarks/engineSync";
import { startProfileDataCleanup } from "./state/profiles/profileData";
import { startProfileLoading } from "./state/profiles/profileLoading";
import { startPrivateSessions } from "./state/windows/privateSessions";
import { startNewTabBar } from "./state/omnibox/newTabBar";
import { perfMark, perfProbeEnabled, probeStore } from "./state/app/perfProbe";
import { startTabLifecycle } from "./state/tabs/tabLifecycle";
import { startTabPages } from "./state/tabs/tabPages";
import { startTabReveal } from "./state/tabs/tabReveal";
import { startPinOrderChoices } from "./state/pins/pinOrderChoices";
import { startNavigation } from "./state/tabs/navigation";
import { startPageState } from "./state/tabs/pageState";
import { startPinnedFold } from "./state/sidebar/pinnedFold";
import { startPinnedOrder } from "./state/sidebar/pinnedOrder";
import { startToolbarAutoHide } from "./state/windows/toolbarAutoHide";
import { startMedia } from "./state/media/media";
import { startArtwork } from "./state/media/artwork";
import { startSync } from "./state/sync/engine";
import { startSharedFolders } from "./state/sharedFolders/engine";
import { setStoreBatching, useBrowser } from "./state/browser/store";
import { installErrorReporting, startTelemetry } from "./state/telemetry";
import { launchCommitted } from "./state/telemetry/journeys";
import { markFirstWindow } from "./state/telemetry/track";

probeStore("browser", useBrowser);
installErrorReporting();
setStoreBatching(unstable_batchedUpdates);
startPersistence({ restoreSession: configRestoreSession() });
startDevMcp();
startConfigFiles(colorRoles);
startDecideHooks();
startProfileLoading();
startFavicons();
startHistory();
startBookmarks();
startProfileDataCleanup();
startPrivateSessions();
startNewTabBar();
startTabPages();
startTabReveal();
startPinOrderChoices();
startNavigation();
startPageState();
startPinnedFold();
startPinnedOrder();
startToolbarAutoHide();
startMedia();
startArtwork();
startNativeSync();
startAppIntegration();
startTabLifecycle();
startTranslate();
startSync();
startTelemetry();
startKillSwitches();
startCliControl();
startOpenWhenDone();
afterFirstWindow(startUserScripts);
afterFirstWindow(startAutomation);
afterFirstWindow(startSharedFolders);
startMemoryTrim();
if (__DEV__ || perfProbeEnabled) require("./components/dev/devHarness").startDevHarness();

const devMountDelay = () => (__DEV__ ? ((globalThis as { acDevMountDelayMs?: number }).acDevMountDelayMs ?? 0) : 0);

function Root({ windowId }: { windowId: string }) {
  const [delay] = useState(devMountDelay);
  const [held, setHeld] = useState(delay > 0);
  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setHeld(false), delay);
    return () => clearTimeout(timer);
  }, []);
  useLayoutEffect(() => launchCommitted(), []);
  useEffect(() => {
    perfMark("firstWindow");
    markFirstWindow();
    firstWindowCommitted();
  }, []);
  if (held) return null;
  return __DEV__ ? (
    <DevErrorBoundary>
      <WindowRoot windowId={windowId} />
    </DevErrorBoundary>
  ) : (
    <WindowRoot windowId={windowId} />
  );
}

AppRegistry.registerComponent("main", () => Root);
perfMark("bundleEnd");
