#import "UniVerseInternal.h"
#import "UniVerseWebView.h"

#import <objc/runtime.h>

namespace {

NSMapTable<UniVerseCoreTab *, UniVerseWebView *> *Views() {
  static NSMapTable *views = [NSMapTable weakToWeakObjectsMapTable];
  return views;
}

NSMutableDictionary<NSString *, UniVerseCoreTab *> *Offered() {
  static NSMutableDictionary *offered = [NSMutableDictionary dictionary];
  return offered;
}

constexpr int64_t kOfferSeconds = 30;

}

@implementation UniVerseTabRegistry

+ (void)setView:(UniVerseWebView *)view forTab:(UniVerseCoreTab *)tab {
  if (view) [Views() setObject:view forKey:tab];
  else [Views() removeObjectForKey:tab];
}

+ (UniVerseWebView *)viewForTab:(UniVerseCoreTab *)tab {
  return [Views() objectForKey:tab];
}

+ (NSString *)offerTab:(UniVerseCoreTab *)tab {
  return [self offerTab:tab prefix:@"universecore"];
}

+ (NSString *)offerTab:(UniVerseCoreTab *)tab prefix:(NSString *)prefix {
  NSString *adoptId = [NSString stringWithFormat:@"%@:%d", prefix, universe_host::BrowserId(tab)];
  Offered()[adoptId] = tab;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kOfferSeconds * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    if (Offered()[adoptId] != tab) return;
    [Offered() removeObjectForKey:adoptId];
    if (![UniVerseTabRegistry viewForTab:tab]) [tab close];
  });
  return adoptId;
}

+ (UniVerseCoreTab *)offeredTab:(NSString *)adoptId {
  return adoptId.length ? Offered()[adoptId] : nil;
}

+ (UniVerseCoreTab *)takeOffered:(NSString *)adoptId {
  UniVerseCoreTab *tab = Offered()[adoptId];
  if (tab) [Offered() removeObjectForKey:adoptId];
  return tab;
}

+ (void)forget:(UniVerseCoreTab *)tab {
  [Views() removeObjectForKey:tab];
  for (NSString *key in [Offered() allKeysForObject:tab]) [Offered() removeObjectForKey:key];
}

@end

namespace universe_host {

namespace {
const void *kBrowserIdKey = &kBrowserIdKey;
NSMapTable<NSNumber *, UniVerseCoreTab *> *TabsById() {
  static NSMapTable *tabs = [NSMapTable strongToWeakObjectsMapTable];
  return tabs;
}
}

int BrowserId(UniVerseCoreTab *tab) {
  static int next = 0;
  NSNumber *id_ = objc_getAssociatedObject(tab, kBrowserIdKey);
  if (!id_) {
    id_ = @(++next);
    objc_setAssociatedObject(tab, kBrowserIdKey, id_, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    [TabsById() setObject:tab forKey:id_];
  }
  return id_.intValue;
}

UniVerseCoreTab *TabWithBrowserId(int browserId) {
  return [TabsById() objectForKey:@(browserId)];
}

NSString *AppTabIdOf(UniVerseCoreTab *tab) {
  NSString *tabId = tab ? [UniVerseTabRegistry viewForTab:tab].transferKey : nil;
  return tabId.length ? tabId : nil;
}

id AppTabIdValue(UniVerseCoreTab *tab) {
  return AppTabIdOf(tab) ?: NSNull.null;
}

UniVerseCoreTab *TabWithAppTabId(NSString *tabId) {
  if (!tabId.length) return nil;
  for (UniVerseCoreTab *tab in Views().keyEnumerator.allObjects)
    if ([[Views() objectForKey:tab].transferKey isEqualToString:tabId]) return tab;
  return nil;
}

namespace {
NSMapTable<UniVerseCoreTab *, NSMutableArray<NSArray *> *> *HeldEvents() {
  static NSMapTable *held = [NSMapTable weakToStrongObjectsMapTable];
  return held;
}
}

void HoldUntilHosted(UniVerseCoreTab *tab, NSString *event, NSDictionary *payload) {
  NSMutableArray *list = [HeldEvents() objectForKey:tab];
  if (!list) [HeldEvents() setObject:(list = [NSMutableArray array]) forKey:tab];
  [list addObject:@[ event, payload ]];
}

void DropHeldEvent(NSString *event, NSString *eventId) {
  for (UniVerseCoreTab *tab in HeldEvents().keyEnumerator.allObjects) {
    NSMutableArray<NSArray *> *list = [HeldEvents() objectForKey:tab];
    NSIndexSet *dropped = [list indexesOfObjectsPassingTest:^BOOL(NSArray *held, NSUInteger, BOOL *) {
      return [held[0] isEqualToString:event] && [held[1][@"id"] isEqual:eventId];
    }];
    [list removeObjectsAtIndexes:dropped];
    if (!list.count) [HeldEvents() removeObjectForKey:tab];
  }
}

void ReleaseHeldEvents(UniVerseCoreTab *tab) {
  NSString *tabId = AppTabIdOf(tab);
  NSArray<NSArray *> *held = tabId ? [HeldEvents() objectForKey:tab] : nil;
  if (!held) return;
  [HeldEvents() removeObjectForKey:tab];
  for (NSArray *event in held) {
    NSMutableDictionary *payload = [event[1] mutableCopy];
    payload[@"tabId"] = tabId;
    [UniVerseEvents emit:event[0] data:payload];
  }
}

}
