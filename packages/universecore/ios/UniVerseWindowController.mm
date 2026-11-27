#import "UniVerseChromeWindowInternal.h"
#import "UniVerseServices.h"
#import "UniVerseWebViewInternal.h"

using namespace universe_window;

namespace universe_window {

BOOL (^gRefusesUnhandledKey)(NSWindow *, NSEvent *);

NSMapTable<NSWindow *, UniVerseWindowController *> *Controllers() {
  static NSMapTable *controllers = [NSMapTable weakToStrongObjectsMapTable];
  return controllers;
}
}

namespace {

void AnnounceStrayTab(ArdiaCoreTab *tab, int tries) {
  if (tab.closed) return;
  NSString *url = tab.url;
  if ((!url.length || [url isEqualToString:@"about:blank"]) && tries < 20) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 25 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{ AnnounceStrayTab(tab, tries + 1); });
    return;
  }
  if (![UniVerseEvents listens:@"extensions"]) return;
  [UniVerseEvents emit:@"extensions.tabs"
               data:@{
                 @"action" : @"adopt", @"url" : url ?: @"", @"profile" : universe_host::ProfileName(tab.profile),
                 @"adoptId" : [UniVerseTabRegistry offerTab:tab prefix:@"tab"]
               }];
}

void HandOffTab(ArdiaCoreTab *tab) {
  UniVerseCoreProfile *profile = tab.profile;
  if (!profile) return (void)dispatch_async(dispatch_get_main_queue(), ^{ [tab closeNow]; });
  UniVerseWebView *view = [UniVerseWindowController hostingViewForProfile:profile];
  if (view || !profile.offTheRecord) {
    if (view && ([view.profile isEqualToString:universe_host::ProfileName(profile)] ||
                 universe_host::IsOffTheRecordOf(profile, view.profile)))
      [view openedTab:tab adoptId:[UniVerseTabRegistry offerTab:tab prefix:@"tab"] disposition:@"foreground"];
    else
      AnnounceStrayTab(tab, 0);
    return;
  }
  if (!(view = [UniVerseWindowController hostingViewForProfile:nil])) return;
  [view openedTab:tab adoptId:[UniVerseTabRegistry offerTab:tab prefix:@"tab"] disposition:@"incognito"];
}

}

@implementation UniVerseWindowController {
  NSHashTable<ArdiaCoreTab *> *_closing;
  NSString *_chromeToken;
  BOOL _awaitingApp;
  BOOL _showInactive;
  BOOL _announced;
  __weak ArdiaCoreTab *_chromeActive;
  id _willCloseObserver;
}

+ (BOOL)userSees:(NSWindow *)window {
  UniVerseWindowController *controller = [self forNSWindow:window];
  if (!controller || controller.stray || controller.standalone) return YES;
  return [[UniVerseWindowFullScreen ofWindow:controller.coreWindow create:YES] seen];
}

+ (void)reconsiderSightOf:(NSWindow *)window {
  UniVerseWindowController *controller = [self forNSWindow:window];
  if (!controller || controller.stray || controller.standalone) return;
  [[UniVerseWindowFullScreen ofWindow:controller.coreWindow create:YES] reconsiderSight];
}

+ (BOOL)userSeesOnlyThroughWindowServer:(NSWindow *)window {
  UniVerseWindowController *controller = [self forNSWindow:window];
  if (!controller || controller.stray || controller.standalone) return NO;
  return [[UniVerseWindowFullScreen ofWindow:controller.coreWindow create:YES] seenOnlyByWindowServer];
}

+ (instancetype)strayWindowForProfile:(UniVerseCoreProfile *)profile {
  ArdiaCoreWindow *coreWindow = [[ArdiaCoreWindow alloc] initWithContentRect:NSMakeRect(0, 0, 800, 600)];
  if (!coreWindow.window) return nil;
  UniVerseWindowController *controller = [[UniVerseWindowController alloc] initWithCoreWindow:coreWindow];
  controller->_stray = YES;
  [Controllers() setObject:controller forKey:coreWindow.window];
  return controller;
}

NSMutableDictionary<NSString *, UniVerseWindowController *> *ChromeMadeWindows() {
  static NSMutableDictionary *windows = [NSMutableDictionary dictionary];
  return windows;
}

+ (instancetype)chromeMadeWindowForProfile:(UniVerseCoreProfile *)profile {
  ArdiaCoreWindow *coreWindow = [[ArdiaCoreWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1360, 860)];
  NSWindow *window = coreWindow.window;
  if (!window) return nil;
  ConfigureWindow(window);
  UniVerseWindowController *controller = [[UniVerseWindowController alloc] initWithCoreWindow:coreWindow];
  controller->_chromeToken = NSUUID.UUID.UUIDString;
  controller->_awaitingApp = YES;
  [Controllers() setObject:controller forKey:window];
  ChromeMadeWindows()[controller->_chromeToken] = controller;
  __weak UniVerseWindowController *weakController = controller;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [weakController stopAwaitingApp];
  });
  return controller;
}

+ (instancetype)claimChromeMadeWindow:(NSString *)token {
  UniVerseWindowController *controller = token.length ? ChromeMadeWindows()[token] : nil;
  if (!controller) return nil;
  [ChromeMadeWindows() removeObjectForKey:token];
  if (!controller->_awaitingApp || !controller.coreWindow.window) return nil;
  controller->_awaitingApp = NO;
  return controller;
}

- (void)stopAwaitingApp {
  if (!_awaitingApp) return;
  _awaitingApp = NO;
  [ChromeMadeWindows() removeObjectForKey:_chromeToken];
  _stray = YES;
  NSArray<ArdiaCoreTab *> *tabs = @[];
  for (UniVerseCoreProfile *profile in universe_host::LoadedProfiles())
    tabs = [tabs arrayByAddingObjectsFromArray:[_coreWindow tabsForProfile:profile]];
  if (!tabs.count) return [_coreWindow close];
  for (ArdiaCoreTab *tab in tabs)
    if (![UniVerseTabRegistry viewForTab:tab]) HandOffTab(tab);
}

- (void)announceChromeMadeTab:(ArdiaCoreTab *)tab tries:(int)tries {
  if (_stray || tab.closed || ![[_coreWindow tabsForProfile:tab.profile] containsObject:tab]) return;
  NSString *moving = [UniVerseTabRegistry viewForTab:tab].transferKey;
  NSString *url = tab.url;
  const BOOL blank = !moving.length && (!url.length || [url isEqualToString:@"about:blank"]);
  if ((blank && tries < 20) || (![UniVerseEvents listens:@"extensions"] && tries < 400)) {
    __weak UniVerseWindowController *weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 25 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
      [weakSelf announceChromeMadeTab:tab tries:tries + 1];
    });
    return;
  }
  if (![UniVerseEvents listens:@"extensions"]) return;
  NSDictionary *request;
  if (moving.length) {
    request = @{@"action" : @"moveInto", @"chromeWindow" : _chromeToken, @"tabId" : moving, @"focused" : @(!_showInactive)};
  } else if ([UniVerseTabRegistry viewForTab:tab]) {
    return;
  } else {
    request = @{
      @"action" : @"adoptInto", @"chromeWindow" : _chromeToken, @"adoptId" : [UniVerseTabRegistry offerTab:tab prefix:@"tab"],
      @"url" : url ?: @"", @"profile" : universe_host::ProfileName(tab.profile), @"active" : @(!_chromeActive || _chromeActive == tab),
      @"focused" : @(!_showInactive)
    };
  }
  _announced = YES;
  [UniVerseEvents emit:@"extensions.tabs" data:request];
}

- (void)window:(ArdiaCoreWindow *)window showRequestedActive:(BOOL)active {
  if (_awaitingApp) _showInactive = !active;
}

NSMapTable<UniVerseCoreProfile *, UniVerseWindowController *> *StandaloneWindows() {
  static NSMapTable *windows = [NSMapTable weakToStrongObjectsMapTable];
  return windows;
}

+ (instancetype)standaloneWindowForProfile:(UniVerseCoreProfile *)profile {
  NSMapTable<UniVerseCoreProfile *, UniVerseWindowController *> *windows = StandaloneWindows();
  UniVerseWindowController *controller = [windows objectForKey:profile];
  if (controller && controller.coreWindow.window) return controller;
  ArdiaCoreWindow *coreWindow = [[ArdiaCoreWindow alloc] initWithContentRect:NSMakeRect(0, 0, 800, 600)];
  if (!coreWindow.window) return nil;
  coreWindow.internal = YES;
  controller = [[UniVerseWindowController alloc] initWithCoreWindow:coreWindow];
  controller->_standalone = YES;
  [Controllers() setObject:controller forKey:coreWindow.window];
  [windows setObject:controller forKey:profile];
  return controller;
}

+ (UniVerseWebView *)hostingViewForProfile:(UniVerseCoreProfile *)profile {
  UniVerseWebView *any = nil;
  for (NSWindow *window in NSApp.orderedWindows) {
    UniVerseWindowController *c = [Controllers() objectForKey:window];
    if (!c || c.stray || c.standalone) continue;
    if (UniVerseWebView *view = profile ? [c anyShownViewForProfile:profile] : nil) return view;
    any = any ?: [c anyView];
  }
  return profile.offTheRecord ? nil : any;
}

+ (instancetype)holding:(ArdiaCoreTab *)tab {
  UniVerseCoreProfile *profile = tab.profile;
  if (!profile) return nil;
  for (UniVerseWindowController *c in Controllers().objectEnumerator)
    if ([[c.coreWindow tabsForProfile:profile] containsObject:tab]) return c;
  return nil;
}

- (void)noteClosing:(ArdiaCoreTab *)tab {
  if (!_closing) _closing = [NSHashTable weakObjectsHashTable];
  [_closing addObject:tab];
  __weak UniVerseWindowController *weakSelf = self;
  __weak ArdiaCoreTab *weakTab = tab;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    UniVerseWindowController *c = weakSelf;
    ArdiaCoreTab *t = weakTab;
    if (c && t) [c->_closing removeObject:t];
  });
}

- (BOOL)appChanging {
  return _hostChanges > 0 || _closing.count > 0;
}

+ (instancetype)forNSWindow:(NSWindow *)window {
  return window ? [Controllers() objectForKey:window] : nil;
}

+ (NSArray<UniVerseWindowController *> *)all {
  return Controllers().objectEnumerator.allObjects;
}

- (instancetype)initWithCoreWindow:(ArdiaCoreWindow *)coreWindow {
  if ((self = [super init])) {
    _coreWindow = coreWindow;
    coreWindow.delegate = self;
    __weak UniVerseWindowController *weakSelf = self;
    _willCloseObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSWindowWillCloseNotification
                                                                         object:coreWindow.window
                                                                          queue:nil
                                                                     usingBlock:^(NSNotification *) {
                                                                       if (UniVerseWindowController *c = weakSelf) [UniVerseTabStrip windowClosed:c];
                                                                     }];
  }
  return self;
}

- (void)dealloc {
  if (_willCloseObserver) [NSNotificationCenter.defaultCenter removeObserver:_willCloseObserver];
}

- (UniVerseWebView *)viewFor:(ArdiaCoreTab *)tab {
  return tab ? [UniVerseTabRegistry viewForTab:tab] : nil;
}

- (UniVerseWebView *)anyShownViewForProfile:(UniVerseCoreProfile *)profile {
  for (ArdiaCoreTab *tab in [_coreWindow tabsForProfile:profile]) {
    UniVerseWebView *view = [UniVerseTabRegistry viewForTab:tab];
    if (view.visible) return view;
  }
  return nil;
}

- (UniVerseWebView *)anyView {
  for (UniVerseCoreProfile *profile in universe_host::LoadedProfiles())
    for (ArdiaCoreTab *tab in [_coreWindow tabsForProfile:profile])
      if (UniVerseWebView *view = [UniVerseTabRegistry viewForTab:tab]) return view;
  return nil;
}

- (void)window:(ArdiaCoreWindow *)window didInsertTab:(ArdiaCoreTab *)tab opener:(ArdiaCoreTab *)opener disposition:(NSString *)disposition {
  [UniVerseTabStrip changedInWindow:self profile:tab.profile];
  if (_hostChanges > 0) return;
  if (_awaitingApp) {
    __weak UniVerseWindowController *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf announceChromeMadeTab:tab tries:0]; });
    return;
  }
  if ([UniVerseTabRegistry viewForTab:tab]) return;
  if (_stray) return HandOffTab(tab);
  UniVerseWebView *openerView = [self viewFor:opener];
  if ([disposition isEqualToString:@"popup"]) {
    return universe_host::OpenPopupWindow(tab, openerView);
  }
  if (openerView) {
    [openerView openedLinkTab:tab adoptId:[UniVerseTabRegistry offerTab:tab] disposition:universe_host::AppDisposition(disposition)];
  } else if (UniVerseWebView *view = [self anyShownViewForProfile:tab.profile]) {
    [view openedTab:tab adoptId:[UniVerseTabRegistry offerTab:tab prefix:@"tab"] disposition:@"foreground"];
  } else {
    HandOffTab(tab);
  }
}

- (void)window:(ArdiaCoreWindow *)window didRemoveTab:(ArdiaCoreTab *)tab {
  [UniVerseTabStrip removed:tab fromWindow:self];
  if (UniVerseCoreProfile *profile = tab.profile) [UniVerseTabStrip changedInWindow:self profile:profile];
  [[self viewFor:tab] tabRemovedFromWindow:window];
  if (_stray || _standalone || _awaitingApp) {
    __weak UniVerseWindowController *weakSelf = self;
    UniVerseCoreProfile *removedProfile = tab.profile;
    dispatch_async(dispatch_get_main_queue(), ^{
      UniVerseWindowController *c = weakSelf;
      if (!c) return;
      NSMutableArray<UniVerseCoreProfile *> *profiles = [universe_host::LoadedProfiles() mutableCopy];
      if (removedProfile) [profiles addObject:removedProfile];
      for (UniVerseCoreProfile *p in profiles)
        if ([c.coreWindow tabsForProfile:p].count) return;
      if (c->_awaitingApp) {
        c->_awaitingApp = NO;
        [ChromeMadeWindows() removeObjectForKey:c->_chromeToken];
        if (c->_announced) [UniVerseEvents emit:@"extensions.tabs" data:@{@"action" : @"closeWindow", @"chromeWindow" : c->_chromeToken}];
      } else if (!c.stray && !c.standalone) {
        return;
      }
      if (c.standalone) {
        NSMapTable<UniVerseCoreProfile *, UniVerseWindowController *> *windows = StandaloneWindows();
        for (UniVerseCoreProfile *p in windows.keyEnumerator.allObjects)
          if ([windows objectForKey:p] == c) [windows removeObjectForKey:p];
      }
      [c.coreWindow close];
    });
  }
  dispatch_async(dispatch_get_main_queue(), ^{ [self->_closing removeObject:tab]; });
}

- (void)window:(ArdiaCoreWindow *)window didActivateTab:(ArdiaCoreTab *)tab {
  if (_awaitingApp) _chromeActive = tab;
  [UniVerseTabStrip activated:tab inWindow:self];
  [UniVerseTabStrip changedInWindow:self profile:tab.profile];
  [[self viewFor:tab] tabActivatedByChrome:!self.appChanging];
}

- (void)window:(ArdiaCoreWindow *)window devToolsDidChangeForTab:(ArdiaCoreTab *)tab view:(NSView *)devToolsView {
  [[self viewFor:tab] devToolsChanged:devToolsView];
}

- (void)window:(ArdiaCoreWindow *)window tab:(ArdiaCoreTab *)tab didChangeFullscreen:(BOOL)fullscreen {
  [FullScreenChanges() setObject:@([FullScreenChanges() objectForKey:tab].unsignedIntegerValue + 1) forKey:tab];
  __weak UniVerseWindowController *weakSelf = self;
  __weak ArdiaCoreTab *weakTab = tab;
  void (^tell)(void) = ^{
    ArdiaCoreTab *t = weakTab;
    if (t) [[weakSelf viewFor:t] emit:@"fullscreen" payload:@{@"fullscreen" : @(fullscreen)}];
  };
  if (_stray || _standalone) return tell();
  [[UniVerseWindowFullScreen ofWindow:window create:YES] tab:tab fullScreen:fullscreen tell:tell];
}

- (void)window:(ArdiaCoreWindow *)window passwordPrompt:(NSDictionary<NSString *, id> *)prompt forTab:(ArdiaCoreTab *)tab {
  UniVerseWebView *view = [self viewFor:tab];
  if (view) universe_host::NotePasswordPromptSource(view, nil);
  [view emit:@"passwordPrompt" payload:prompt];
}

- (void)window:(ArdiaCoreWindow *)window autofillPrompt:(NSDictionary<NSString *, id> *)prompt forTab:(ArdiaCoreTab *)tab {
  [[self viewFor:tab] emit:@"autofillPrompt" payload:prompt];
}

- (BOOL)windowShouldClose:(ArdiaCoreWindow *)window {
  return [UniVerseChromeWindowHost windowShouldClose:window.window];
}

- (void)windowDidCancelClose:(ArdiaCoreWindow *)window {
  NSLog(@"[universecore] window close cancelled");
  [UniVerseWebView retryPagesInWindow:self];
}

- (void)windowCanTakeTabs:(ArdiaCoreWindow *)window {
  [UniVerseWebView retryPagesInWindow:self];
}

- (void)window:(ArdiaCoreWindow *)window confirmCloseWithDownloads:(int)count completion:(void (^)(BOOL))completion {
  completion(YES);
}

- (BOOL)window:(ArdiaCoreWindow *)window preHandleKeyEvent:(NSEvent *)event {
  return UniVersePerformReservedKey(event);
}

- (BOOL)window:(ArdiaCoreWindow *)window handleKeyEvent:(NSEvent *)event {
  if (KeepsUnhandledSidebarKeyInPage(window.window, event)) return YES;
  const NSEventModifierFlags mods = event.modifierFlags & NSEventModifierFlagDeviceIndependentFlagsMask;
  if (event.type == NSEventTypeKeyDown && event.keyCode == 53 && !(mods & (NSEventModifierFlagCommand | NSEventModifierFlagOption | NSEventModifierFlagControl))) {
    NSResponder *focused = window.window.firstResponder;
    UniVerseWebView *target = nil;
    for (UniVerseCoreProfile *profile in universe_host::LoadedProfiles()) {
      for (ArdiaCoreTab *tab in [window tabsForProfile:profile]) {
        UniVerseWebView *view = [UniVerseTabRegistry viewForTab:tab];
        if (view.visible && [focused isKindOfClass:NSView.class] && [(NSView *)focused isDescendantOf:tab.view]) target = view;
      }
      if (target) break;
    }
    [target emit:@"command" payload:@{@"command" : @"escape", @"text" : @""}];
  }
  return gRefusesUnhandledKey && gRefusesUnhandledKey(window.window, event);
}

@end
