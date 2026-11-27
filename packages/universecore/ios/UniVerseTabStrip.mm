#import "UniVerseTabStrip.h"

#import "UniVerseInternal.h"
#import "UniVerseWebView.h"
#import "UniVerseEngineBridge.h"
#import "UniVerseServices.h"

namespace {

int64_t gRev = 0;

NSMapTable<UniVerseWindowController *, NSMutableDictionary<NSNumber *, NSString *> *> *KnownStrips() {
  static NSMapTable *known = [NSMapTable weakToStrongObjectsMapTable];
  return known;
}

void Remember(UniVerseWindowController *controller, int strip, NSString *profile) {
  if (strip < 0) return;
  NSMutableDictionary *strips = [KnownStrips() objectForKey:controller];
  if (!strips) {
    strips = [NSMutableDictionary dictionary];
    [KnownStrips() setObject:strips forKey:controller];
  }
  strips[@(strip)] = profile;
}
NSNumber *gCommand;
__weak UniVerseWindowController *gCommandWindow;
__weak UniVerseCoreProfile *gCommandProfile;

NSMutableDictionary<NSNumber *, NSDictionary *> *Sent() {
  static NSMutableDictionary *sent = [NSMutableDictionary dictionary];
  return sent;
}

void Send(NSDictionary *tx) {
  for (NSDictionary *strip in tx[@"strips"]) {
    if ([strip[@"closed"] boolValue]) [Sent() removeObjectForKey:strip[@"strip"]];
    else Sent()[strip[@"strip"]] = strip;
  }
  [UniVerseEvents emit:@"tabs.strips" data:tx];
}

NSMutableDictionary<NSNumber *, NSDictionary *> *Groups() {
  static NSMutableDictionary *groups = [NSMutableDictionary dictionary];
  return groups;
}

NSMapTable<ArdiaCoreTab *, NSNumber *> *Pinned() {
  static NSMapTable *pinned = [NSMapTable weakToStrongObjectsMapTable];
  return pinned;
}

NSMapTable<UniVerseCoreProfile *, ArdiaCoreTab *> *ActiveTabs(UniVerseWindowController *controller) {
  static NSMapTable *byWindow = [NSMapTable weakToStrongObjectsMapTable];
  NSMapTable *active = [byWindow objectForKey:controller];
  if (!active) {
    active = [NSMapTable weakToWeakObjectsMapTable];
    [byWindow setObject:active forKey:controller];
  }
  return active;
}

NSString *AppWindowOf(UniVerseWindowController *controller) {
  NSMutableArray<NSView *> *views = [NSMutableArray array];
  if (controller.root) [views addObject:controller.root];
  for (NSUInteger i = 0; i < views.count && i < 16; i++) {
    NSView *view = views[i];
    if ([view respondsToSelector:NSSelectorFromString(@"appProperties")]) {
      id properties = [view valueForKey:@"appProperties"];
      id windowId = [properties isKindOfClass:NSDictionary.class] ? properties[@"windowId"] : nil;
      if ([windowId isKindOfClass:NSString.class]) return windowId;
    }
    [views addObjectsFromArray:view.subviews];
  }
  return nil;
}

NSDictionary *Strip(UniVerseWindowController *controller, UniVerseCoreProfile *profile) {
  ArdiaCoreWindow *window = controller.coreWindow;
  NSMutableArray *tabs = [NSMutableArray array];
  NSArray<ArdiaCoreTab *> *live = [window tabsForProfile:profile];
  ArdiaCoreTab *active = [ActiveTabs(controller) objectForKey:profile];
  for (NSUInteger i = 0; i < live.count; i++) {
    ArdiaCoreTab *tab = live[i];
    NSString *key = [UniVerseTabRegistry viewForTab:tab].transferKey;
    [tabs addObject:@{
      @"key" : key.length ? key : NSNull.null,
      @"browser" : @(universe_host::BrowserId(tab)),
      @"index" : @(i),
      @"active" : @(tab == active || (!active && i == 0)),
      @"pinned" : @([[Pinned() objectForKey:tab] boolValue]),
      @"group" : Groups()[@([window chromeWindowIdForProfile:profile])][@"tabs"][@(tab.tabId)] ?: NSNull.null,
    }];
  }
  const int strip = [window chromeWindowIdForProfile:profile];
  NSString *name = universe_host::ProfileName(profile);
  Remember(controller, strip, name);
  NSMutableDictionary *state = [@{
    @"strip" : @(strip),
    @"window" : @(window.window.windowNumber),
    @"profile" : name,
    @"tabs" : tabs,
  } mutableCopy];
  state[@"groups"] = Groups()[@(strip)][@"groups"] ?: @[];
  if ([Groups()[@(strip)][@"activePickedOnClose"] boolValue]) state[@"activePickedOnClose"] = @YES;
  if (NSString *appWindow = AppWindowOf(controller)) state[@"appWindow"] = appWindow;
  return state;
}

NSArray<UniVerseCoreProfile *> *ProfilesWithTabs(UniVerseWindowController *controller) {
  NSMutableArray *profiles = [NSMutableArray array];
  for (UniVerseCoreProfile *profile in universe_host::LoadedProfiles())
    if ([controller.coreWindow chromeWindowIdForProfile:profile] >= 0) [profiles addObject:profile];
  return profiles;
}

}

@implementation UniVerseTabStrip

+ (void)watchStrips {
  static bool watching = false;
  if (watching) return;
  watching = true;
  [UniVerseEngineBridge observe:@"tabs.strip"
                      handler:^(NSDictionary *strip) {
                        NSNumber *window = [strip[@"window"] isKindOfClass:NSNumber.class] ? strip[@"window"] : nil;
                        if (!window) return;
                        if ([strip[@"closed"] boolValue]) return (void)[Groups() removeObjectForKey:window];
                        NSMutableDictionary *byTab = [NSMutableDictionary dictionary];
                        for (NSDictionary *tab in strip[@"tabs"])
                          if ([tab isKindOfClass:NSDictionary.class] && tab[@"tab"]) byTab[tab[@"tab"]] = tab[@"group"] ?: NSNull.null;
                        NSDictionary *before = Groups()[window];
                        NSDictionary *now = @{
                          @"groups" : strip[@"groups"] ?: @[],
                          @"tabs" : byTab,
                          @"activePickedOnClose" : @([strip[@"activePickedOnClose"] boolValue]),
                        };
                        Groups()[window] = now;
                        if ([before isEqualToDictionary:now] || gCommand) return;
                        for (UniVerseWindowController *c in UniVerseWindowController.all)
                          for (UniVerseCoreProfile *p in universe_host::LoadedProfiles())
                            if ([c.coreWindow chromeWindowIdForProfile:p] == window.intValue)
                              [UniVerseTabStrip changedInWindow:c profile:p cause:c.hostChanges > 0 ? @(-1) : NSNull.null];
                      }];
  [UniVerseServices call:@"ac_tabs_watch" profile:@"" args:nil completion:^(NSDictionary *) {}];
}

+ (void)changedInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile {
  [self changedInWindow:controller profile:profile cause:nil];
}

+ (void)changedInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile cause:(id)cause {
  if (![UniVerseEvents listens:@"tabs"] || !controller || !profile || controller.standalone) return;
  if (gCommand && controller == gCommandWindow && profile == gCommandProfile) return;
  cause = cause ?: (gCommand ?: (controller.hostChanges > 0 ? @(-1) : NSNull.null));
  NSDictionary *strip = Strip(controller, profile);
  if ((cause == NSNull.null || [cause isEqual:@(-1)]) && [Sent()[strip[@"strip"]] isEqualToDictionary:strip]) return;
  Send(@{@"rev" : @(++gRev), @"cmd" : cause, @"strips" : @[ strip ]});
}

+ (void)windowClosed:(UniVerseWindowController *)controller {
  NSDictionary<NSNumber *, NSString *> *strips = [KnownStrips() objectForKey:controller];
  [KnownStrips() removeObjectForKey:controller];
  if (![UniVerseEvents listens:@"tabs"] || !strips.count) return;
  NSMutableArray *closed = [NSMutableArray array];
  const NSInteger window = controller.coreWindow.window.windowNumber;
  for (NSNumber *strip in strips)
    [closed addObject:@{@"strip" : strip, @"window" : @(window), @"profile" : strips[strip], @"tabs" : @[], @"closed" : @YES}];
  Send(@{@"rev" : @(++gRev), @"cmd" : NSNull.null, @"strips" : closed});
}

+ (void)activated:(ArdiaCoreTab *)tab inWindow:(UniVerseWindowController *)controller {
  UniVerseCoreProfile *profile = tab.profile;
  if (profile) [ActiveTabs(controller) setObject:tab forKey:profile];
}

+ (ArdiaCoreTab *)activeTabInWindow:(UniVerseWindowController *)controller profile:(UniVerseCoreProfile *)profile {
  return profile ? [ActiveTabs(controller) objectForKey:profile] : nil;
}

+ (void)removed:(ArdiaCoreTab *)tab fromWindow:(UniVerseWindowController *)controller {
  UniVerseCoreProfile *profile = tab.profile;
  if (profile && [ActiveTabs(controller) objectForKey:profile] == tab) [ActiveTabs(controller) removeObjectForKey:profile];
}

+ (void)setPinned:(BOOL)pinned tab:(ArdiaCoreTab *)tab {
  [Pinned() setObject:@(pinned) forKey:tab];
}

+ (NSDictionary<NSString *, id> *)allStrips {
  NSMutableArray *strips = [NSMutableArray array];
  for (UniVerseWindowController *controller in UniVerseWindowController.all)
    if (!controller.standalone)
      for (UniVerseCoreProfile *profile in ProfilesWithTabs(controller)) [strips addObject:Strip(controller, profile)];
  for (NSDictionary *strip in strips) Sent()[strip[@"strip"]] = strip;
  return @{@"rev" : @(gRev), @"cmd" : NSNull.null, @"strips" : strips};
}

+ (void)command:(NSInteger)commandId command:(NSDictionary<NSString *, id> *)command {
  NSString *op = command[@"op"];
  const int stripId = [command[@"strip"] intValue];
  UniVerseWindowController *found = nil;
  UniVerseCoreProfile *profile = nil;
  for (UniVerseWindowController *controller in UniVerseWindowController.all)
    for (UniVerseCoreProfile *p in ProfilesWithTabs(controller))
      if ([controller.coreWindow chromeWindowIdForProfile:p] == stripId) found = controller, profile = p;
  NSMutableDictionary<NSString *, ArdiaCoreTab *> *byKey = [NSMutableDictionary dictionary];
  for (ArdiaCoreTab *tab in found ? [found.coreWindow tabsForProfile:profile] : @[]) {
    NSString *key = [UniVerseTabRegistry viewForTab:tab].transferKey;
    if (key.length) byKey[key] = tab;
  }
  BOOL rejected = !found;
  gCommand = @(commandId);
  gCommandWindow = found;
  gCommandProfile = profile;
  if (found && [op isEqualToString:@"activate"]) {
    ArdiaCoreTab *tab = byKey[command[@"key"]];
    if (tab) {
      [found.coreWindow activateTab:tab];
    } else {
      rejected = YES;
    }
  } else if (found && [op isEqualToString:@"arrange"]) {
    NSArray<NSString *> *keys = [command[@"keys"] isKindOfClass:NSArray.class] ? command[@"keys"] : @[];
    const NSInteger pinned = [command[@"pinned"] integerValue];
    int index = 0;
    rejected = keys.count > 0;
    for (NSString *key in keys)
      if (byKey[key]) rejected = NO;
    for (NSUInteger i = 0; i < keys.count; i++) {
      ArdiaCoreTab *tab = byKey[keys[i]];
      if (!tab) continue;
      [self setPinned:(NSInteger)i < pinned tab:tab];
      [found.coreWindow placeTab:tab index:index pinned:(NSInteger)i < pinned];
      index++;
    }
  }
  if (found && [op isEqualToString:@"group"]) {
    NSMutableArray *ids = [NSMutableArray array];
    for (NSString *key in [command[@"keys"] isKindOfClass:NSArray.class] ? command[@"keys"] : @[])
      if (ArdiaCoreTab *tab = byKey[key]) [ids addObject:@(tab.tabId)];
    if (!ids.count) rejected = YES;
    else {
      NSMutableDictionary *args = [@{@"window" : @(stripId), @"tabs" : ids} mutableCopy];
      id group = command[@"group"];
      args[@"group"] = [group isKindOfClass:NSString.class] ? group : @"";
      for (NSString *key in @[ @"title", @"color" ])
        if ([command[key] isKindOfClass:NSString.class]) args[key] = command[key];
      if ([command[@"collapsed"] isKindOfClass:NSNumber.class]) args[@"collapsed"] = command[@"collapsed"];
      gCommand = nil;
      UniVerseWindowController *controller = found;
      UniVerseCoreProfile *p = profile;
      [UniVerseServices call:@"ac_tabs_group" profile:universe_host::OriginalProfileNameOf(profile) args:args completion:^(NSDictionary *result) {
        NSMutableDictionary *tx = [@{@"rev" : @(++gRev), @"cmd" : @(commandId), @"strips" : @[ Strip(controller, p) ]} mutableCopy];
        if (result[@"error"]) tx[@"rejected"] = @YES;
        if ([UniVerseEvents listens:@"tabs"]) Send(tx);
      }];
      return;
    }
  }
  gCommand = nil;
  NSMutableDictionary *tx = [@{@"rev" : @(++gRev), @"cmd" : @(commandId), @"strips" : found ? @[ Strip(found, profile) ] : @[]} mutableCopy];
  if (rejected) tx[@"rejected"] = @YES;
  if ([UniVerseEvents listens:@"tabs"]) Send(tx);
}

@end
