#ifndef UNIVERSE_CORE_AC_HOOKS_H_
#define UNIVERSE_CORE_AC_HOOKS_H_

#include <memory>
#include <optional>
#include <string>

#include "universe/core/ac_content_hooks.h"
#include "base/containers/span.h"
#include "base/functional/callback_forward.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/scoped_refptr.h"
#include "chrome/browser/file_system_access/file_system_access_permission_request_manager.h"
#include "chrome/browser/ui/extensions/extension_popup_types.h"
#include "components/permissions/permission_prompt.h"
#include "content/public/browser/media_stream_request.h"
#include "extensions/browser/extension_install_prompt_client.h"
#include "ui/base/resource/resource_bundle.h"

class Browser;
class BrowserUiController;
class BrowserWebContentsDelegate;
class BrowserWindow;
class BrowserWindowInterface;
class DesktopBrowserWindowCapabilities;
class ExclusiveAccessManager;
class GURL;
class Profile;
class SkBitmap;
class UnloadController;

namespace autofill {
struct Suggestion;
}

namespace chrome {
class BrowserCommandController;
}

namespace content {
class BrowserContext;
class RenderFrameHost;
class WeakDocumentPtr;
}

namespace extensions {
class Extension;
class InstallPromptData;
}

namespace media_router {
class MediaRouterUI;
}

namespace permissions {
class ChooserController;
}

namespace ui {
class Accelerator;
}

namespace url {
class Origin;
}

namespace web_app {
class AppBrowserController;
}

extern bool g_universe_embedder;

extern ui::ResourceBundle::Delegate* g_universe_resource_bundle_delegate;

extern bool g_universe_viewless_browsers;

extern bool g_universe_skip_cpu_health_sampling;

extern bool g_universe_background_instance;

extern BrowserWindow* (*g_universe_browser_window_factory)(Browser*);

extern bool (*g_universe_keeps_window_without_tabs)(
    const BrowserWindowInterface* browser);

extern std::unique_ptr<BrowserWebContentsDelegate> (
    *g_universe_create_web_contents_delegate)(
    BrowserWindowInterface* browser,
    ExclusiveAccessManager& exclusive_access_manager,
    chrome::BrowserCommandController& command_controller,
    UnloadController& unload_controller,
    web_app::AppBrowserController* app_browser_controller,
    BrowserWindow& window,
    DesktopBrowserWindowCapabilities& capabilities,
    BrowserUiController& browser_ui_controller);

extern std::unique_ptr<permissions::PermissionPrompt> (
    *g_universe_create_permission_prompt)(
    content::WebContents* web_contents,
    permissions::PermissionPrompt::Delegate* delegate,
    bool* default_handling);

extern bool (*g_universe_file_system_restore_prompt)(
    const FileSystemAccessPermissionRequestManager::RequestData& request,
    base::OnceCallback<void(permissions::PermissionAction)>& callback,
    content::WebContents* web_contents);

extern bool (*g_universe_external_protocol_dialog)(
    const GURL& url,
    content::WebContents* web_contents,
    const std::optional<url::Origin>& initiating_origin,
    content::WeakDocumentPtr initiator_document,
    const std::u16string& program_name);

extern bool (*g_universe_history_eligible)(content::WebContents*);

namespace autofill {
extern void (*g_universe_autofill_suggestions_shown)(
    content::WebContents* web_contents,
    base::span<const Suggestion> suggestions);
}

extern bool (*g_universe_password_bubble)(content::WebContents* web_contents);

extern bool (*g_universe_device_chooser)(
    content::WebContents* contents,
    std::unique_ptr<permissions::ChooserController>* controller,
    base::ScopedClosureRunner* fullscreen_blocker,
    base::OnceClosure* close_closure);

extern bool (*g_universe_media_access_request)(
    content::WebContents* web_contents,
    const content::MediaStreamRequest& request,
    content::MediaResponseCallback* callback);

extern bool (*g_universe_wants_cast_dialog)(content::WebContents* initiator);

extern bool (*g_universe_cast_dialog)(content::WebContents* initiator,
                                   media_router::MediaRouterUI* ui,
                                   base::ScopedClosureRunner* fullscreen_blocker);

extern bool (*g_universe_hidden_from_extensions)(
    const BrowserWindowInterface* browser);

extern bool (*g_universe_omits_from_session_service)(
    const BrowserWindowInterface* browser);

extern bool (*g_universe_extension_install_prompt)(
    Profile* profile,
    content::WebContents* parent,
    const extensions::InstallPromptData& prompt,
    extensions::ExtensionInstallPromptClient::DoneCallback* done_callback);

extern bool (*g_universe_extension_installed)(
    Profile* profile,
    scoped_refptr<const extensions::Extension> extension,
    const SkBitmap* icon);

namespace download_crx_util {
extern bool g_universe_prompts_without_tab;
}

extern bool (*g_universe_extension_side_panel)(
    BrowserWindowInterface* browser_window,
    content::WebContents* web_contents,
    const extensions::ExtensionId& extension_id,
    bool open);

extern std::optional<bool> (*g_universe_open_action_popup)(
    BrowserWindowInterface& browser,
    const extensions::Extension& extension,
    ShowPopupCallback& callback,
    std::string* error);

extern void (*g_universe_devtools_dock_changed)(BrowserWindowInterface* browser,
                                             content::WebContents* inspected,
                                             content::WebContents* devtools);

extern int (*g_universe_tab_shown_by_host)(content::WebContents*);

extern bool (*g_universe_reserved_accelerator)(const ui::Accelerator& accelerator);

extern bool (*g_universe_reserved_global_accelerator)(const ui::Accelerator& accelerator);

extern void (*g_universe_global_shortcuts_resumed)();

namespace extensions {
void UniVerseReregisterGlobalCommands(content::BrowserContext* context);
}

void UniVerseAutoPictureInPictureHostVisibilityChanged(
    content::WebContents* contents);

#endif
