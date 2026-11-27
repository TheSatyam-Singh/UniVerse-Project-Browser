#include "universe/core/ac_devtools_theme.h"

#include "base/functional/bind.h"
#include "base/strings/utf_string_conversions.h"
#include "base/values.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"

namespace universecore {

namespace {

constexpr char kThemeScript[] = R"THEME(
  (() => {
    const id = "universe-devtools-theme";
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = ":root{color-scheme:dark;"
      + "--sys-color-primary:#a78bfa;--sys-color-on-primary:#1e1b4b;"
      + "--sys-color-primary-container:#312e81;--sys-color-on-primary-container:#ede9fe;"
      + "--sys-color-secondary:#a78bfa;--sys-color-tertiary:#c4b5fd;"
      + "--sys-color-surface:#14121f;--sys-color-surface-dim:#0e0c18;--sys-color-surface-bright:#1c1930;"
      + "--sys-color-surface-container-lowest:#0e0c18;--sys-color-surface-container-low:#14121f;"
      + "--sys-color-surface-container:#1c1930;--sys-color-surface-container-high:#262238;"
      + "--sys-color-surface-container-highest:#322d4d;"
      + "--sys-color-on-surface:#e7e5f4;--sys-color-on-surface-variant:#b9b4d0;"
      + "--sys-color-outline:#4a4468;--sys-color-outline-variant:#322e4d;"
      + "--sys-color-cdt-base-container:#14121f;"
      + "--color-accent:#a78bfa;--color-background:#14121f;"
      + "--color-background-elevation-0:#14121f;--color-background-elevation-1:#1c1930;"
      + "--color-background-elevation-2:#262238;"
      + "--color-text-primary:#e7e5f4;--color-text-secondary:#b9b4d0;--color-link:#a78bfa;}";
  })();
)THEME";

class DevToolsTheme : public content::WebContentsObserver,
                      public content::WebContentsUserData<DevToolsTheme> {
 public:
  ~DevToolsTheme() override = default;

  void DocumentAvailableInMainFrame() override { Inject(); }

  void DidFinishNavigation(
      content::NavigationHandle* navigation_handle) override {
    if (navigation_handle->IsInPrimaryMainFrame()) {
      Inject();
    }
  }

 private:
  explicit DevToolsTheme(content::WebContents* web_contents)
      : content::WebContentsObserver(web_contents) {}

  void Inject() {
    content::RenderFrameHost* frame = web_contents()->GetPrimaryMainFrame();
    if (!frame) {
      return;
    }
    frame->ExecuteJavaScript(
        base::UTF8ToUTF16(kThemeScript),
        base::BindOnce([](base::Value) {}));
  }

  friend class content::WebContentsUserData<DevToolsTheme>;
  WEB_CONTENTS_USER_DATA_KEY_DECL();
};

WEB_CONTENTS_USER_DATA_KEY_IMPL(DevToolsTheme);

}

void AttachDevToolsTheme(content::WebContents* devtools) {
  if (devtools) {
    DevToolsTheme::CreateForWebContents(devtools);
  }
}

}
