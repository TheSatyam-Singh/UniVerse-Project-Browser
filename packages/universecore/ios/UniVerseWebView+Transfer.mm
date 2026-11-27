#import "UniVerseWebViewInternal.h"
#import "UniVerseLaunchTabHolder.h"
#import "UniVerseFieldTiming.h"
#import "UniVerseNavigationDownloads.h"
#import "UniVerseServices.h"
#import "UniVerseTabParking.h"

using namespace universe_web_view;

static NSMutableSet<NSString *> *BoundRestoreKeys() {
  static NSMutableSet *keys = [NSMutableSet set];
  return keys;
}

static NSHashTable<UniVerseWebView *> *WaitingViews() {
  static NSHashTable *views = [NSHashTable weakObjectsHashTable];
  return views;
}

static const NSUInteger kMaxSavedHistoryBytes = 32 * 1024 * 1024;

static NSString *SavedHistoryGeneration(UniVerseCoreProfile *profile) {
  __block NSString *generation = nil;
  [UniVerseServices call:@"ac_tab_history_generation" profile:universe_host::ProfileName(profile) args:nil
               completion:^(NSDictionary *result) {
                 if (result[@"error"]) return;
                 if ([result[@"generation"] isKindOfClass:NSString.class]) {
                   generation = result[@"generation"];
                 } else if ([result[@"fromMarker"] isEqual:@YES]) {
                   NSString *marker = [profile.path stringByAppendingPathComponent:@"UniVerse Project Browser Tab History Cleared"];
                   NSString *saved = [NSString stringWithContentsOfFile:marker encoding:NSUTF8StringEncoding error:nil];
                   if (saved || ![NSFileManager.defaultManager fileExistsAtPath:marker])
                     generation = [saved ?: @"" stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
                 }
               }];
  return generation;
}

static UniVerseCoreTab *RestoreSavedHistory(UniVerseWindowController *controller, UniVerseCoreProfile *profile, NSString *key, NSString *url) {
  if (!key.length || !url.length || [BoundRestoreKeys() containsObject:key] || !profile.path.length ||
      profile.offTheRecord || !controller.coreWindow)
    return nil;
  NSData *keyBytes = [key dataUsingEncoding:NSUTF8StringEncoding];
  const unsigned char *raw = (const unsigned char *)keyBytes.bytes;
  NSMutableString *name = [NSMutableString stringWithCapacity:keyBytes.length * 2];
  for (NSUInteger i = 0; i < keyBytes.length; i++) [name appendFormat:@"%02X", raw[i]];
  NSString *file = [[profile.path stringByAppendingPathComponent:@"UniVerse Project Browser Tab History"] stringByAppendingPathComponent:name];
  NSData *data = [NSData dataWithContentsOfFile:file options:NSDataReadingMappedIfSafe error:nil];
  if (!data.length || data.length > kMaxSavedHistoryBytes) return nil;
  NSDictionary *saved = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![saved isKindOfClass:NSDictionary.class] || ![saved[@"version"] isEqual:@1]) return nil;
  NSString *state = [saved[@"state"] isKindOfClass:NSString.class] ? saved[@"state"] : nil;
  NSString *committed = [saved[@"url"] isKindOfClass:NSString.class] ? saved[@"url"] : nil;
  NSString *shown = [saved[@"virtualUrl"] isKindOfClass:NSString.class] ? saved[@"virtualUrl"] : nil;
  if (!state.length || !(SamePage(committed, url) || SamePage(shown, url))) return nil;
  NSString *generation = SavedHistoryGeneration(profile);
  if (!generation || ![saved[@"generation"] isEqual:generation]) return nil;
  controller.hostChanges++;
  UniVerseCoreTab *tab = [controller.coreWindow restoreTab:state profile:profile foreground:NO];
  controller.hostChanges--;
  [tab loadIfNeeded];
  return tab;
}

static UniVerseCoreTab *StartParkedPage(NSString *url, NSString *profileName, NSString *key) {
  if (!url.length || !UniVerseHost.isStarted) return nil;
  NSString *scheme = [NSURLComponents componentsWithString:url].scheme.lowercaseString;
  if (![scheme isEqualToString:@"http"] && ![scheme isEqualToString:@"https"]) return nil;
  profileName = profileName ?: @"";
  if (universe_host::IsPrivateProfile(profileName) || universe_host::IsDeletedProfile(profileName)) return nil;
  UniVerseCoreProfile *profile = universe_host::LoadedProfile(profileName);
  if (!profile || universe_host::WasNavigationDownload(url, profileName)) return nil;
  UniVerseWindowController *keeper = [UniVerseWindowController strayWindowForProfile:profile];
  if (!keeper) return nil;
  UniVerseCoreTab *tab = RestoreSavedHistory(keeper, profile, key, url);
  keeper.hostChanges++;
  if (!tab) tab = [keeper.coreWindow openTab:url profile:profile foreground:NO];
  keeper.hostChanges--;
  if (!tab) {
    [keeper.coreWindow close];
    return nil;
  }
  UniVerseLaunchTabHolder *holder = [UniVerseLaunchTabHolder new];
  holder.url = url;
  holder.profile = profileName;
  [UniVerseTabParking keepOffscreen:tab holder:holder];
  return tab;
}

@implementation UniVerseWebView (Transfer)

+ (void)prepareTransfer:(NSString *)transferKey {
  if (!transferKey.length) return;
  NSString *key = [transferKey copy];
  dispatch_async(dispatch_get_main_queue(), ^{
    for (UniVerseWebView *view in LiveViews().allObjects)
      if (view->_tab && [view->_transferKey isEqualToString:key]) view->_life.handingOff = YES;
  });
}

- (BOOL)releasePageForOffscreen {
  if (!_tab || _visible || _warm || _reveal.active || _leave.active || _frameHold.holding || _standalone) return NO;
  [self detach];
  return YES;
}

+ (void)releaseTransfer:(NSString *)transferKey {
  if (!transferKey.length) return;
  NSString *key = [transferKey copy];
  dispatch_async(dispatch_get_main_queue(), ^{
    for (UniVerseWebView *view in LiveViews().allObjects)
      if ([view->_transferKey isEqualToString:key]) view->_life.handingOff = NO;
    [UniVerseTabParking releaseTransfer:key];
  });
}

+ (void)startLaunchTab:(NSString *)transferKey url:(NSString *)url profile:(NSString *)profileName {
  [UniVerseTabParking holdLaunchTab:transferKey url:url profile:profileName opening:^UniVerseCoreTab * {
    return StartParkedPage(url, profileName, transferKey);
  }];
}

+ (void)claimLaunchTab:(NSString *)transferKey url:(NSString *)url profile:(NSString *)profile {
  [UniVerseTabParking claimLaunchTab:transferKey url:url profile:profile];
}

+ (void)startLinkTabs:(NSArray<NSString *> *)urls profile:(NSString *)profileName {
  NSString *profile = [profileName copy] ?: @"";
  [UniVerseTabParking holdLinkTabs:urls profile:profile opening:^UniVerseCoreTab *(NSString *url) {
    return StartParkedPage(url, profile, nil);
  }];
}

+ (NSDictionary<NSString *, id> *)routeLinkTabs:(NSArray<NSString *> *)urls {
  return [UniVerseTabParking routeLinkTabs:urls];
}

- (BOOL)takeLinkTab:(NSString *)adoptId {
  UniVerseCoreTab *tab = [UniVerseTabParking parkLinkTab:adoptId forKey:_transferKey];
  if (!tab) return NO;
  if ([self takeTransferredTab] != UniVerseTransferNone) return YES;
  [UniVerseTabParking discardTab:tab forKey:_transferKey];
  return NO;
}

- (void)ensureTab {
  if (_tab || !_life.canCreate() || _life.offerClosed || !self.window || !UniVerseHost.isStarted || !self.controller) return;
  if ([self takeTransferredTab] != UniVerseTransferNone) return;
  if ([_adoptId hasPrefix:@"link:"]) {
    NSString *link = _adoptId;
    _adoptId = nil;
    if ([UniVerseTabParking takeDismissedLinkMark:link]) {
      _life.offerClosed = YES;
      __weak UniVerseWebView *weakSelf = self;
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf emit:@"windowClose" payload:@{}];
      });
      return;
    }
    if (!_standalone && !_extensionHost.length && [self takeLinkTab:link]) return;
  }
  if ([_adoptId hasPrefix:@"universecore:"] || [_adoptId hasPrefix:@"tab:"]) {
    UniVerseCoreTab *offered = [UniVerseTabRegistry takeOffered:_adoptId];
    _adoptId = nil;
    if (offered.closed) {
      _life.offerClosed = YES;
      __weak UniVerseWebView *weakSelf = self;
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf emit:@"windowClose" payload:@{}];
      });
      return;
    }
    if (offered && ![self canTake:offered]) {
      if (!offered.closed) [offered closeNow];
      offered = nil;
    }
    if (offered && !offered.closed && [self holdTransferOf:offered]) {
      if (_transferKey.length) [UniVerseTabParking park:offered forKey:_transferKey];
      return;
    }
    if (offered && !offered.closed) return [self attach:offered];
  }
  NSString *kind = nil, *key = nil;
  NSRange colon = _adoptId ? [_adoptId rangeOfString:@":"] : NSMakeRange(NSNotFound, 0);
  if (colon.location != NSNotFound) {
    kind = [_adoptId substringToIndex:colon.location];
    key = [_adoptId substringFromIndex:NSMaxRange(colon)];
  }
  _adoptId = nil;
  const NSUInteger generation = _life.beginCreating();
  __weak UniVerseWebView *weakSelf = self;
  universe_host::WithProfile(_profile, ^(UniVerseCoreProfile *profile) {
    UniVerseWebView *view = weakSelf;
    if (!view || !view->_life.isCurrent(generation)) return;
    view->_life.leaveCreating();
    UniVerseWindowController *controller = view.controller;
    if (!profile || view->_tab || !controller) return;
    const BOOL standalone = view->_standalone;
    NSString *pending = view->_life.pendingURL;
    NSString *url = pending ?: view->_initialURL;
    view->_life.pendingURL = nil;
    view->_life.creatingURL = url;
    view->_life.creatingAt = CACurrentMediaTime();
    if (view->_extensionHost.length && url.length && controller.coreWindow) {
      if (UniVerseCoreTab *tab = [controller.coreWindow openExtensionView:url profile:profile kind:view->_extensionHost])
        return [view attach:tab];
    }
    if (standalone) controller = [UniVerseWindowController standaloneWindowForProfile:profile] ?: controller;
    if (!standalone && [kind isEqualToString:@"clone"] && [view cloneTab:key profile:profile]) return;
    if (!standalone && [kind isEqualToString:@"restore"] && url.length && !universe_host::IsPrivateProfile(view->_profile) && controller.coreWindow) {
      view->_life.resumeCreating();
      view->_life.pendingURL = pending;
      [UniVerseServices call:@"ac_tab_restore_take" profile:view->_profile args:@{@"key" : key}
                completion:^(NSDictionary *result) {
                  UniVerseWebView *later = weakSelf;
                  if (!later || !later->_life.isCurrent(generation)) return;
                  later->_life.leaveCreating();
                  UniVerseWindowController *now = later.controller;
                  if (later->_tab || !now) return;
                  NSString *state = [result[@"state"] isKindOfClass:NSString.class] ? result[@"state"] : nil;
                  UniVerseCoreTab *tab = nil;
                  now.hostChanges++;
                  if (state.length) tab = [now.coreWindow restoreTab:state profile:profile foreground:NO];
                  if (!tab) {
                    if (later->_life.pendingURL == pending) later->_life.pendingURL = nil;
                    tab = [now.coreWindow openTab:url profile:profile foreground:NO];
                  }
                  now.hostChanges--;
                  if (tab) [later attach:tab];
                  else [later waitForWindow];
                }];
      return;
    }
    const BOOL userInitiated = view->_life.pendingUserInitiated;
    if (url.length && [view skipsNavigationDownload:url userInitiated:userInitiated]) url = nil;
    if (url.length) UniVerseFieldMarkNow(view->_transferKey, @"request");
    UniVerseCoreTab *tab = !standalone && !userInitiated && !universe_host::IsPrivateProfile(view->_profile)
                            ? RestoreSavedHistory(controller, profile, view->_transferKey, url)
                            : nil;
    controller.hostChanges++;
    if (!tab) tab = [controller.coreWindow openTab:url.length ? url : @"" profile:profile foreground:NO];
    controller.hostChanges--;
    if (!tab) [view waitForWindow];
    if (url.length && tab.loading) UniVerseFieldMarkNow(view->_transferKey, @"start");
    if (tab) [view attach:tab];
    if (tab && url.length) [view focusAfterLoad];
  });
}

- (BOOL)cloneTab:(NSString *)sourceKey profile:(UniVerseCoreProfile *)profile {
  UniVerseWindowController *controller = self.controller;
  if (!controller.coreWindow) return NO;
  UniVerseCoreTab *source = nil;
  for (UniVerseWebView *other in LiveViews())
    if (other != self && [other.transferKey isEqualToString:sourceKey] && other->_tab && !other->_tab.closed) source = other->_tab;
  if (!source || source.profile != profile) return NO;
  UniVerseWindowController *holder = [UniVerseWindowController holding:source];
  _life.pendingURL = nil;
  controller.hostChanges++;
  holder.hostChanges++;
  UniVerseCoreTab *tab = [controller.coreWindow duplicateTab:source profile:profile foreground:NO];
  holder.hostChanges--;
  controller.hostChanges--;
  if (!tab) return NO;
  [self attach:tab];
  return YES;
}

+ (BOOL)keepTransfersOfWindow:(NSWindow *)window {
  UniVerseWindowController *closing = [UniVerseWindowController forNSWindow:window];
  if (!closing.coreWindow) return YES;
  for (UniVerseWebView *view in LiveViews().allObjects)
    if (view->_life.handingOff && view->_tab && !view->_tab.closed && [UniVerseWindowController holding:view->_tab] == closing)
      [view closeBrowser];
  return [UniVerseTabParking rehomeFromWindow:closing];
}

- (BOOL)canTake:(UniVerseCoreTab *)tab {
  UniVerseCoreProfile *profile = tab.profile;
  if (!profile || tab.closed || profile.offTheRecord != universe_host::IsPrivateProfile(_profile)) return NO;
  if (profile.offTheRecord) return universe_host::IsOffTheRecordOf(profile, _profile);
  return [universe_host::ProfileName(profile) isEqualToString:_profile ?: @""];
}

+ (void)retryPagesInWindow:(UniVerseWindowController *)controller {
  for (UniVerseWebView *view in WaitingViews().allObjects) {
    if (view.controller != controller) continue;
    [WaitingViews() removeObject:view];
    if (!view->_tab) [view ensureTab];
  }
}

- (void)waitForWindow {
  [WaitingViews() addObject:self];
}

- (UniVerseTransfer)takeTransferredTab {
  if (!_transferKey.length) return UniVerseTransferNone;
  if ([UniVerseTabParking launchWasClosed:_transferKey]) {
    if (!_life.launchCloseSent) {
      _life.launchCloseSent = YES;
      __weak UniVerseWebView *weakSelf = self;
      dispatch_async(dispatch_get_main_queue(), ^{
        UniVerseWebView *view = weakSelf;
        if (view && !view->_tab) [view emit:@"windowClose" payload:@{}];
      });
    }
    return UniVerseTransferTaken;
  }
  UniVerseCoreTab *tab = [UniVerseTabParking parkedTabForKey:_transferKey];
  if (tab && ![self canTake:tab]) return UniVerseTransferNone;
  if (tab && !tab.closed && [self holdTransferOf:tab]) return UniVerseTransferHeld;
  if (tab) [UniVerseTabParking unpark:_transferKey];
  if (!tab) {
    for (UniVerseWebView *other in LiveViews().allObjects) {
      if (other == self || ![other.transferKey isEqualToString:_transferKey] || !other->_tab) continue;
      if (![self canTake:other->_tab]) return UniVerseTransferNone;
      if (!other->_tab.closed && [self holdTransferOf:other->_tab]) return UniVerseTransferHeld;
      tab = other->_tab;
      [other detach];
      break;
    }
  }
  if (!tab || tab.closed) return UniVerseTransferNone;
  [UniVerseTabParking tookTransfer:_transferKey];
  _adoptId = nil;
  UniVerseLaunchTabHolder *launch = (UniVerseLaunchTabHolder *)[UniVerseTabParking takeHolderOfTab:tab];
  _life.transferredURL = launch.url ?: tab.url;
  if (SamePage(_life.pendingURL, _life.transferredURL)) _life.pendingURL = nil;
  [self attach:tab];
  if (launch) {
    _requests.loadedOnce = YES;
    _requests.requestedURL = launch.url;
    [launch replayTo:self tab:tab];
    [self focusAfterLoad];
  }
  return UniVerseTransferTaken;
}

- (void)bindRestoreKey {
  if (!_tab || !_transferKey.length || universe_host::IsPrivateProfile(_profile) || !UniVerseHost.isStarted) return;
  [BoundRestoreKeys() addObject:_transferKey];
  [UniVerseServices call:@"ac_tab_restore_tag" profile:_profile args:@{@"tab" : @(_tab.tabId), @"key" : _transferKey}
            completion:^(NSDictionary *) {}];
}

- (void)closeBrowser {
  UniVerseCoreTab *tab = _tab;
  if (tab && _life.handingOff && _transferKey.length && !tab.closed) {
    _life.handOff();
    [self detach];
    [UniVerseTabParking park:tab forKey:_transferKey];
    return;
  }
  _life.close();
  if (!tab) return;
  if (_transferKey.length && !universe_host::IsPrivateProfile(_profile) && UniVerseHost.isStarted)
    [UniVerseServices call:@"ac_tab_restore_tag" profile:_profile args:@{@"tab" : @(tab.tabId), @"key" : _transferKey}
              completion:^(NSDictionary *) {}];
  [[UniVerseWindowController holding:tab] noteClosing:tab];
  UniVerseWebView *holder = _standIn.lentTo;
  [self detach];
  if (![holder closesLentTab:tab]) [tab closeNow];
}

@end
