#include "universe/core/ac_seams.h"

#import <AppKit/AppKit.h>

#include <memory>

#include "base/functional/callback.h"
#include "chrome/browser/universe/ac_cli_visible_tabs.h"
#include "chrome/browser/lifetime/browser_shutdown.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "components/permissions/chooser_controller.h"
#include "components/sessions/content/content_live_tab.h"
#include "components/sessions/core/live_tab.h"
#include "components/sessions/core/session_id.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/web_contents.h"
#include "extensions/browser/extension_install_prompt_client.h"
#include "extensions/common/extension_id.h"
#include "universe/core/ac_hooks.h"
#include "universe/core/ac_browser.h"
#include "universe/core/ac_cast_dialog.h"
#include "universe/core/ac_browser_window.h"
#include "universe/core/ac_desktop_capture.h"
#include "universe/core/ac_device_chooser.h"
#include "universe/core/ac_extension_shortcuts.h"
#include "universe/core/ac_extension_view.h"
#include "universe/core/ac_host_visibility.h"
#include "universe/core/ac_installed_bubble.h"
#include "universe/core/ac_launch_switches.h"
#include "ui/base/cocoa/drag_permission.h"
#import "universe/core/universecore_api_internal.h"
#import "universe/core/universecore_internal.h"

namespace universecore {

namespace {

bool HandlePasswordBubble(content::WebContents* web_contents) {
  WindowHost* host = WindowHost::ForContents(web_contents);
  return host && host->OfferPasswordSave(web_contents);
}

bool HandleExtensionSidePanel(BrowserWindowInterface* browser_window,
                              content::WebContents* web_contents,
                              const extensions::ExtensionId& extension_id,
                              bool open) {
  content::WebContents* contents = web_contents;
  if (!contents && browser_window && browser_window->GetActiveTabInterface()) {
    contents = browser_window->GetActiveTabInterface()->GetContents();
  }
  if (!WindowHost::ForContents(contents)) {
    return false;
  }
  return HostExtensionSidePanel(contents, extension_id, open);
}

bool LiveTabSkipsRestore(sessions::LiveTab* live_tab, SessionID* source) {
  if (live_tab &&
      InAutomationWindow(
          &static_cast<sessions::ContentLiveTab*>(live_tab)->GetWebContents())) {
    return true;
  }
  int32_t source_id = 0;
  if (!live_tab || !IsTemporaryTabId(live_tab->GetSessionID().id(), &source_id)) {
    return false;
  }
  if (source && source_id > 0) {
    *source = SessionID::FromSerializedValue(source_id);
  }
  return true;
}

bool OmitsFromSessionService(const BrowserWindowInterface* browser) {
  return ACBrowserWindow::IsOurs(browser);
}

bool IsHiddenFromExtensions(const BrowserWindowInterface* browser) {
  WindowHost* host = WindowHost::ForBrowser(browser);
  return host && host->internal();
}

bool KeepsWindowWithoutTabs(const BrowserWindowInterface* browser) {
  WindowHost* host = WindowHost::ForBrowser(browser);
  return host && !host->closing() && !browser_shutdown::IsTryingToQuit();
}

std::unique_ptr<BrowserWebContentsDelegate> CreateWebContentsDelegate(
    BrowserWindowInterface* browser,
    ExclusiveAccessManager& exclusive_access_manager,
    chrome::BrowserCommandController& command_controller,
    UnloadController& unload_controller,
    web_app::AppBrowserController* app_browser_controller,
    BrowserWindow& window,
    DesktopBrowserWindowCapabilities& capabilities,
    BrowserUiController& browser_ui_controller) {
  ACBrowserWindow* ours = ACBrowserWindow::FromWindow(&window);
  if (!ours) {
    return nullptr;
  }
  ours->Register(browser);
  return std::make_unique<ACWebContentsDelegate>(
      browser, exclusive_access_manager, command_controller, unload_controller,
      app_browser_controller, window, capabilities, browser_ui_controller,
      ours->host_weak());
}

const char* BrowserTypeName(BrowserWindowInterface::Type type) {
  switch (type) {
    case BrowserWindowInterface::TYPE_NORMAL:
      return "normal";
    case BrowserWindowInterface::TYPE_POPUP:
      return "popup";
    case BrowserWindowInterface::TYPE_DEVTOOLS:
      return "devtools";
    case BrowserWindowInterface::TYPE_PICTURE_IN_PICTURE:
      return "picture_in_picture";
    default:
      return "app";
  }
}

BrowserWindow* WindowForChromeBrowser(Browser* browser) {
  if (ACBrowserWindow::IsOurs(browser) ||
      browser->GetType() == BrowserWindowInterface::TYPE_PICTURE_IN_PICTURE) {
    return nullptr;
  }
  UniVerseCoreWindow* window = [g_delegate
      engineWindowForNewBrowserOfProfile:[UniVerseCoreProfile
                                             wrapperFor:browser->GetProfile()]
                                    type:@(BrowserTypeName(browser->GetType()))];
  WindowHost* host = window.host;
  return host ? host->HostChromeBrowser(browser) : nullptr;
}

bool IsReservedAccelerator(const ui::Accelerator& accelerator) {
  NSEvent* event = NSApp.currentEvent;
  return event.type == NSEventTypeKeyDown &&
         ExtensionShortcuts::AcceleratorFor(event) == accelerator &&
         [g_delegate engineIsReservedKeyEvent:event];
}

bool IsHistoryEligible(content::WebContents* contents) {
  WindowHost* host = WindowHost::ForContents(contents);
  return !host || !host->internal();
}

void DevToolsDockChanged(BrowserWindowInterface* browser,
                         content::WebContents* inspected,
                         content::WebContents* devtools) {
  if (WindowHost* host = WindowHost::ForBrowser(browser)) {
    host->DevToolsDockChanged(inspected, devtools);
  }
}

}

void InstallChromeHooks() {
  g_universe_browser_window_factory = &WindowForChromeBrowser;
  g_universe_reserved_accelerator = &IsReservedAccelerator;
  g_universe_reserved_global_accelerator = &IsReservedGlobalAccelerator;
  g_universe_global_shortcuts_resumed = &GlobalShortcutsResumed;
  g_universe_history_eligible = &IsHistoryEligible;
  InstallRuleMatchedHook();
  InstallExtensionInstalledHook();
  InstallActionPopupHook();
  g_universe_password_bubble = &HandlePasswordBubble;
  g_universe_extension_install_prompt = &HostExtensionInstallPrompt;
  g_universe_device_chooser = &HandleDeviceChooser;
  g_universe_media_access_request = &AnswerNativeDisplayCapture;
  g_universe_wants_cast_dialog = &WantsCastDialog;
  g_universe_cast_dialog = &HandleCastDialog;
  g_universe_extension_side_panel = &HandleExtensionSidePanel;
  g_universe_hidden_from_extensions = &IsHiddenFromExtensions;
  g_universe_keeps_window_without_tabs = &KeepsWindowWithoutTabs;
  g_universe_devtools_dock_changed = &DevToolsDockChanged;
  g_universe_create_web_contents_delegate = &CreateWebContentsDelegate;
  g_universe_initial_main_document_accessed = &InitialMainDocumentAccessed;
  g_universe_live_tab_skips_restore = &LiveTabSkipsRestore;
  g_universe_omits_from_session_service = &OmitsFromSessionService;
  g_universe_viewless_browsers = true;
  universe::InstallCliVisibleTabs();
  if (TestFlag("nativeDragRefused")) {
    ui::UniVerseRefuseDragSessionInitiation();
  }
}

}
