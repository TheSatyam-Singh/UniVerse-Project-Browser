#import <AppKit/AppKit.h>

#import "UniVerseCore.h"
#import "UniVerseEvents.h"
#import "UniVerseFavicons.h"
#import "UniVerseHost.h"
#import "UniVerseTabStrip.h"
#import "UniVerseTabRegistry.h"
#import "UniVerseWindowController.h"

@class UniVerseWebView;

NS_ASSUME_NONNULL_BEGIN

namespace universe_host {

UniVerseCoreProfile *_Nullable LoadedProfile(NSString *name);
bool IsDeletedProfile(NSString *name);
void WithProfile(NSString *name, void (^completion)(UniVerseCoreProfile *_Nullable profile));
NSString *ProfileName(UniVerseCoreProfile *_Nullable profile);
UniVerseCoreProfile *_Nullable PersonalIfLoaded(UniVerseCoreEngine *engine);
bool IsPrivateProfile(NSString *_Nullable name);
bool IsPrivateSessionId(NSString *_Nullable name);
NSString *ProfileDirectoryName(NSString *_Nullable name);
NSString *ProfileNameOfDirectoryName(NSString *_Nullable directory);
NSString *OriginalProfileName(NSString *_Nullable name);
NSString *OriginalProfileNameOf(UniVerseCoreProfile *_Nullable profile);
bool IsOffTheRecordOf(UniVerseCoreProfile *_Nullable profile, NSString *_Nullable name);
NSArray<NSString *> *LoadedProfileNames();

int BrowserId(UniVerseCoreTab *tab);
UniVerseCoreTab *_Nullable TabWithBrowserId(int browserId);
NSString *_Nullable AppTabIdOf(UniVerseCoreTab *_Nullable tab);
id AppTabIdValue(UniVerseCoreTab *_Nullable tab);
UniVerseCoreTab *_Nullable TabWithAppTabId(NSString *_Nullable tabId);
void HoldUntilHosted(UniVerseCoreTab *tab, NSString *event, NSDictionary *payload);
void ReleaseHeldEvents(UniVerseCoreTab *tab);
void DropHeldEvent(NSString *event, NSString *eventId);

NSString *AppDisposition(NSString *chromeDisposition);

void InstallActivationGuardsEarly();
void InstallActivationGuardsLate();
bool Background();
void LogActivation(NSString *what);
void WatchFocusChanges();
NSString *FocusState();
NSString *PageMoveAt(NSWindow *window, NSPoint point);
NSString *HoverProbeDev(NSWindow *window, NSString *_Nullable argument);
NSString *HoverProbeLine();
void WatchHover();
NSString *DescribeFocusWindow(NSWindow *_Nullable window);
void NoteFocusChange(NSString *what, NSWindow *_Nullable window);
void SetAppActive(bool active);
void ActToggleFullScreen(NSWindow *window);
void InstallTestCrashGuard(NSString *_Nullable dataDir);

void OpenPopupWindow(UniVerseCoreTab *tab, UniVerseWebView *_Nullable opener);
UniVerseCoreWindow *_Nullable PopupWindowForChromeBrowser(UniVerseCoreProfile *profile);
bool IsReservedKeyEvent(NSEvent *event);
bool IsReservedBinding(NSString *key, NSString *unshiftedKey, NSEventModifierFlags modifiers);
NSUInteger PopupWindowCount();
bool AskPermissionInPopupWindow(UniVerseCoreTab *tab, NSDictionary *request);
void DropPopupWindowPermission(NSString *requestId);
void NotePasswordPromptSource(UniVerseWebView *view, UniVerseCoreTab *_Nullable source);
UniVerseCoreTab *_Nullable PasswordPromptTab(UniVerseWebView *view, UniVerseCoreTab *_Nullable own);

}

@interface UniVerseTabStrip (Engine)
+ (void)changedInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile;
+ (void)changedInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile cause:(nullable id)cause;
+ (void)windowClosed:(UniVerseWindowController *)controller;
+ (void)activated:(UniVerseCoreTab *)tab inWindow:(UniVerseWindowController *)controller;
+ (nullable UniVerseCoreTab *)activeTabInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile;
+ (void)removed:(UniVerseCoreTab *)tab fromWindow:(UniVerseWindowController *)controller;
+ (void)setPinned:(BOOL)pinned tab:(UniVerseCoreTab *)tab;
@end

namespace universe_host {
NSArray<UniVerseCoreProfile *> *LoadedProfiles();
void LoadContentBlocker(NSString *profile);
void PrepareContentBlocker();
}

@interface UniVerseFavicons (Tabs)
+ (void)noteImage:(nullable NSImage *)image forURL:(nullable NSString *)url profile:(nullable NSString *)profile;
@end

NS_ASSUME_NONNULL_END
