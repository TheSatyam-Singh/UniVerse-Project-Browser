#import "universe/core/public/UniVerseCore.h"

#include <optional>
#include <string>

#include "base/strings/sys_string_conversions.h"
#include "chrome/browser/lifetime/browser_shutdown.h"
#include "chrome/browser/performance_manager/public/user_tuning/user_performance_tuning_manager.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/resource_coordinator/lifecycle_unit_state.mojom.h"
#include "chrome/browser/resource_coordinator/tab_lifecycle_unit_external.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/recently_audible_helper.h"
#include "chrome/browser/ui/tabs/tab_enums.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/unload_controller.h"
#include "components/favicon/content/content_favicon_driver.h"
#include "components/find_in_page/find_tab_helper.h"
#include "components/find_in_page/find_types.h"
#include "components/sessions/content/session_tab_helper.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/navigation_entry.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/gfx/image/image.h"
#include "url/gurl.h"
#include "url/origin.h"
#include "url/scheme_host_port.h"
#include "universe/core/ac_autofill_prompt.h"
#include "universe/core/ac_autofill_trigger.h"
#include "universe/core/ac_browser.h"
#include "universe/core/ac_content_hooks.h"
#include "universe/core/ac_extension_view.h"
#include "universe/core/ac_page_channel.h"
#include "universe/core/ac_password_prompt.h"
#include "universe/core/ac_tab_info.h"
#import "universe/core/universecore_api_internal.h"
#import "universe/core/universecore_internal.h"
#import "universe/core/universecore_tab_internal.h"

using universecore::NS;

@interface UniVerseCoreInputSuppression : NSObject
- (instancetype)initWithContents:(content::WebContents*)contents;
@end

@implementation UniVerseCoreInputSuppression {
  std::optional<content::WebContents::ScopedIgnoreInputEvents> _ignoring;
}

- (instancetype)initWithContents:(content::WebContents*)contents {
  if ((self = [super init])) {
    _ignoring.emplace(contents->IgnoreInputEvents(std::nullopt));
  }
  return self;
}

- (void)dealloc {
  _ignoring.reset();
}

@end

@implementation UniVerseCoreTab

@synthesize delegate = _delegate;

- (instancetype)initWithContents:(content::WebContents*)contents {
  if ((self = [super init])) {
    static int lastBrowserId = 0;
    _contents = contents;
    _browserId = ++lastBrowserId;
  }
  return self;
}

- (int)browserId {
  return _browserId;
}

- (BOOL)initialDocumentAccessed {
  return _contents && content::UniVerseHasAccessedInitialMainDocument(_contents);
}

- (BOOL)committedInitial {
  if (!_contents) {
    return NO;
  }
  content::NavigationEntry* entry = _contents->GetController().GetLastCommittedEntry();
  return !entry || entry->IsInitialEntry();
}

+ (NSString*)originForURL:(NSString*)url {
  GURL gurl(base::SysNSStringToUTF8(url ?: @""));
  if (!gurl.is_valid()) {
    return nil;
  }
  const url::Origin origin = url::Origin::Create(gurl);
  const url::SchemeHostPort& tuple = origin.GetTupleOrPrecursorTupleIfOpaque();
  return tuple.IsValid() ? base::SysUTF8ToNSString(tuple.Serialize()) : @"";
}

- (NSString*)committedOrigin {
  if (!_contents) {
    return nil;
  }
  content::NavigationEntry* entry = _contents->GetController().GetLastCommittedEntry();
  if (!entry || entry->IsInitialEntry()) {
    return nil;
  }
  const url::SchemeHostPort& tuple =
      _contents->GetPrimaryMainFrame()->GetLastCommittedOrigin().GetTupleOrPrecursorTupleIfOpaque();
  return tuple.IsValid() ? base::SysUTF8ToNSString(tuple.Serialize()) : @"";
}

- (id)suppressInput {
  return _contents ? [[UniVerseCoreInputSuppression alloc] initWithContents:_contents] : nil;
}

- (NSString*)faviconURL {
  if (!_contents) {
    return nil;
  }
  const GURL& url = universecore::TabBridge::GetOrCreate(_contents)->favicon_url();
  return url.is_valid() ? NS(url.spec()) : nil;
}

- (NSString*)themeColor {
  std::optional<SkColor> color = _contents ? _contents->GetThemeColor() : std::nullopt;
  if (!color) {
    return nil;
  }
  return [NSString stringWithFormat:@"#%02x%02x%02x", SkColorGetR(*color),
                                    SkColorGetG(*color), SkColorGetB(*color)];
}

- (BOOL)audible {
  if (!_contents) {
    return NO;
  }
  if (auto* helper = RecentlyAudibleHelper::FromWebContents(_contents)) {
    return helper->WasRecentlyAudible();
  }
  return _contents->IsCurrentlyAudible();
}

- (BOOL)muted {
  return _contents && _contents->IsAudioMuted();
}

- (void)setMuted:(BOOL)muted {
  if (_contents) {
    _contents->SetAudioMuted(muted);
  }
}

- (NSDictionary*)securityInfo {
  return universecore::SecurityInfoFor(_contents);
}

- (BOOL)discard {
  if (!_contents) {
    return NO;
  }
  auto* unit =
      resource_coordinator::TabLifecycleUnitExternal::FromWebContents(_contents);
  return unit && unit->DiscardTab(
                     ::mojom::LifecycleUnitDiscardReason::EXTERNAL);
}

- (BOOL)discarded {
  return _contents && _contents->WasDiscarded();
}

- (NSString*)discardReason {
  if (!_contents || !_contents->WasDiscarded()) {
    return nil;
  }
  auto* usage = performance_manager::user_tuning::UserPerformanceTuningManager::
      PreDiscardResourceUsage::FromWebContents(_contents);
  if (!usage) {
    return nil;
  }
  switch (usage->discard_reason()) {
    case ::mojom::LifecycleUnitDiscardReason::EXTERNAL:
      return @"external";
    case ::mojom::LifecycleUnitDiscardReason::URGENT:
      return @"urgent";
    case ::mojom::LifecycleUnitDiscardReason::PROACTIVE:
      return @"proactive";
    case ::mojom::LifecycleUnitDiscardReason::SUGGESTED:
      return @"suggested";
    case ::mojom::LifecycleUnitDiscardReason::FROZEN_WITH_GROWING_MEMORY:
      return @"frozen";
  }
  return nil;
}

- (BOOL)frozen {
  return _contents && universecore::TabBridge::GetOrCreate(_contents)->frozen();
}

- (void)setFrozen:(BOOL)frozen {
  if (frozen && _contents &&
      _contents->GetVisibility() == content::Visibility::VISIBLE) {
    return;
  }
  if (_contents) {
    universecore::TabBridge::GetOrCreate(_contents)->set_frozen(frozen);
    _contents->SetPageFrozen(frozen);
  }
}

- (void)resolveUnresponsive:(BOOL)terminate {
  if (_contents) {
    universecore::TabBridge::GetOrCreate(_contents)->ResolveUnresponsive(terminate);
  }
}

- (NSSize)preferredSize {
  const gfx::Size size =
      _contents ? universecore::ExtensionPopupPreferredSize(_contents) : gfx::Size();
  return NSMakeSize(size.width(), size.height());
}

- (NSDictionary<NSString*, NSNumber*>*)popupFeatures {
  universecore::TabBridge* bridge =
      _contents ? universecore::TabBridge::FromWebContents(_contents) : nullptr;
  return bridge ? bridge->popup_features() : nil;
}

- (BOOL)showAutofillSuggestions:(BOOL)passwords {
  return universecore::ShowAutofillSuggestions(_contents, passwords);
}

- (content::WebContents*)contents {
  return _contents;
}

- (void)contentsDestroyed {
  _contents = nullptr;
}

- (void)notify:(SEL)selector {
  id<UniVerseCoreTabDelegate> delegate = _delegate;
  if ([delegate respondsToSelector:selector]) {
    [delegate performSelector:selector withObject:self];
  }
}

- (BOOL)closed {
  if (!_contents) {
    return YES;
  }
  universecore::TabBridge* bridge = universecore::TabBridge::FromWebContents(_contents);
  return bridge && bridge->closing_after_unload();
}

- (NSView*)view {
  return _contents ? _contents->GetNativeView().GetNativeNSView() : nil;
}

- (UniVerseCoreProfile*)profile {
  return _contents ? [UniVerseCoreProfile
                         wrapperFor:Profile::FromBrowserContext(
                                        _contents->GetBrowserContext())]
                   : nil;
}

- (int)tabId {
  return _contents ? sessions::SessionTabHelper::IdForTab(_contents).id() : -1;
}

- (NSString*)url {
  return _contents ? NS(_contents->GetVisibleURL().spec()) : @"";
}

- (NSString*)title {
  return _contents ? NS(_contents->GetTitle()) : @"";
}

- (BOOL)loading {
  return _contents && _contents->IsLoading();
}

- (double)progress {
  return _contents ? _contents->GetLoadProgress() : 0;
}

- (NSImage*)favicon {
  if (!_contents) {
    return nil;
  }
  auto* driver = favicon::ContentFaviconDriver::FromWebContents(_contents);
  if (!driver || !driver->FaviconIsValid()) {
    return nil;
  }
  gfx::Image image = driver->GetFavicon();
  return image.IsEmpty() ? nil : image.ToNSImage();
}

- (BOOL)canGoBack {
  return _contents && _contents->GetController().CanGoBack();
}

- (BOOL)canGoForward {
  return _contents && _contents->GetController().CanGoForward();
}

- (void)focus {
  if (_contents) {
    auto focusing = universecore::TabBridge::GetOrCreate(_contents)->HostFocuses();
    _contents->Focus();
  }
}

- (void)find:(NSString*)text forward:(BOOL)forward {
  if (!_contents) {
    return;
  }
  universecore::TabBridge::GetOrCreate(_contents)->EnsureFindObserved();
  if (auto* helper = find_in_page::FindTabHelper::FromWebContents(_contents)) {
    helper->StartFinding(base::SysNSStringToUTF16(text), forward,
                         false, true);
  }
}

- (void)stopFinding {
  if (!_contents) {
    return;
  }
  if (auto* helper = find_in_page::FindTabHelper::FromWebContents(_contents)) {
    helper->StopFinding(find_in_page::SelectionAction::kKeep);
  }
}

- (BOOL)temporary {
  return _contents && universecore::TabBridge::GetOrCreate(_contents)->temporary();
}

- (void)setTemporary:(BOOL)temporary {
  if (_contents) {
    universecore::TabBridge::GetOrCreate(_contents)->SetTemporary(temporary);
  }
}

- (void)deliverHeldPageMessages {
  if (_contents) {
    universecore::PageChannel::GetOrCreate(_contents)->DeliverHeld();
  }
}

- (void)setTemporarySource:(UniVerseCoreTab*)source {
  if (_contents) {
    universecore::TabBridge::GetOrCreate(_contents)->SetTemporarySource(
        source && source->_contents
            ? sessions::SessionTabHelper::IdForTab(source->_contents).id()
            : 0);
  }
}

- (void)closeNow {
  if (universecore::DeferWhileAnyNotifies(^{
        [self closeNow];
      })) {
    return;
  }
  if (!_contents || universecore::CloseExtensionView(_contents)) {
    return;
  }
  BrowserWindowInterface* browser =
      GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(_contents);
  if (!browser) {
    return;
  }
  universecore::TabBridge* bridge = universecore::TabBridge::GetOrCreate(_contents);
  if (bridge->closing_after_unload() ||
      browser->GetTabStripModel()->GetIndexOfWebContents(_contents) ==
          TabStripModel::kNoTab) {
    return;
  }
  bridge->set_closed_by_host();
  if (!browser_shutdown::HasShutdownStarted() &&
      _contents->NeedToFireBeforeUnloadOrUnloadEvents()) {
    bridge->CloseAfterUnloadHandlers(
        browser_shutdown::IsTryingToQuit() ||
        UnloadController::From(browser)->is_attempting_to_close_browser());
    return;
  }
  universecore::DeleteTabClosedByHost(_contents);
}

- (void)close {
  if (universecore::DeferWhileAnyNotifies(^{
        [self close];
      })) {
    return;
  }
  if (!_contents || universecore::CloseExtensionView(_contents)) {
    return;
  }
  BrowserWindowInterface* browser =
      GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(_contents);
  if (!browser) {
    return;
  }
  universecore::TabBridge::GetOrCreate(_contents)->set_closed_by_host();
  TabStripModel* model = browser->GetTabStripModel();
  int index = model->GetIndexOfWebContents(_contents);
  if (index != TabStripModel::kNoTab) {
    uint32_t close_types = TabCloseTypes::CLOSE_USER_GESTURE;
    if (!universecore::OnlyShowedBlank(_contents)) {
      close_types |= TabCloseTypes::CLOSE_CREATE_HISTORICAL_TAB;
    }
    model->CloseWebContentsAt(index, close_types);
  }
}

- (NSDictionary<NSString*, id>*)passwordPrompt {
  return universecore::PasswordPrompt(_contents);
}

- (void)resolvePasswordPrompt:(NSString*)action
                     username:(NSString*)username
                     password:(NSString*)password {
  universecore::ResolvePasswordPrompt(_contents, action, username, password);
}

- (NSDictionary<NSString*, id>*)autofillPrompt {
  return universecore::AutofillPrompt(_contents);
}

- (void)resolveAutofillPrompt:(NSInteger)promptId action:(NSString*)action {
  universecore::ResolveAutofillPrompt(_contents, promptId, action);
}

@end
