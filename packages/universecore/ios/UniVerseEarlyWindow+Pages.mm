#import "UniVerseEarlyWindowInternal.h"
#import "UniVerseChromeWindowHost.h"
#import "UniVerseEngineBridge.h"
#import "UniVerseTabParking.h"
#import "UniVerseWebViewInternal.h"

#import <ImageIO/ImageIO.h>
#import <objc/message.h>
#import <CommonCrypto/CommonDigest.h>
#import <QuartzCore/QuartzCore.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#include <cmath>
#include <initializer_list>
#include <mach/mach.h>

using namespace universe_early_window;

@implementation UniVerseEarlyVeil
@end

@implementation UniVersePageEmits
@end

namespace {

constexpr double kVeilFailSafeSeconds = 2;

constexpr NSUInteger kOlderEmitsKept = 256;

NSMapTable<UniVerseCoreTab *, UniVerseEarlyVeil *> *Veils() {
  static NSMapTable *veils = [NSMapTable weakToStrongObjectsMapTable];
  return veils;
}

NSMapTable<UniVerseCoreTab *, UniVersePageEmits *> *Emits() {
  static NSMapTable *emits = [NSMapTable weakToStrongObjectsMapTable];
  return emits;
}

UniVersePageEmits *EmitsOf(UniVerseCoreTab *tab) {
  UniVersePageEmits *emits = [Emits() objectForKey:tab];
  if (!emits && tab) {
    emits = [UniVersePageEmits new];
    emits.generation = 1;
    emits.current = [NSMutableOrderedSet orderedSet];
    emits.older = [NSMutableOrderedSet orderedSet];
    [Emits() setObject:emits forKey:tab];
  }
  return emits;
}

void Archive(UniVersePageEmits *emits, NSString *url) {
  [emits.older removeObject:url];
  [emits.older addObject:url];
  while (emits.older.count > kOlderEmitsKept) {
    [emits.older removeObjectAtIndex:0];
    emits.forgot = YES;
  }
}

}

namespace universe_early_window {

NSHashTable<UniVerseCoreTab *> *Watched() {
  static NSHashTable *watched = [NSHashTable weakObjectsHashTable];
  return watched;
}

}

namespace {

NSString *OriginOfURL(NSString *url) {
  if ([url.lowercaseString hasPrefix:@"view-source:"]) url = [url substringFromIndex:12];
  return universe_web_view::OriginOf(url);
}

BOOL Untitled(NSString *url) {
  return !url.length || [url isEqualToString:@"about:blank"];
}

BOOL IsFile(NSString *url) {
  if ([url.lowercaseString hasPrefix:@"view-source:"]) url = [url substringFromIndex:12];
  return [url.lowercaseString hasPrefix:@"file:"];
}

BOOL ShownMatches(NSString *shownURL, UniVerseCoreTab *tab) {
  if (shownURL.length && [[Emits() objectForKey:tab].current containsObject:shownURL]) return YES;
  NSString *shown = OriginOfURL(shownURL), *live = tab.committedOrigin;
  if (shown.length && live.length && !IsFile(shownURL) && !IsFile(tab.url)) return [shown isEqualToString:live];
  NSString *url = tab.url;
  return Untitled(shownURL) ? Untitled(url) : [shownURL isEqualToString:url];
}

}

namespace universe_early_window {

BOOL ShowsLaunchOrigin(UniVerseCoreTab *tab, NSString *launchURL) {
  NSString *launch = OriginOfURL(launchURL);
  if (!launch) return NO;
  NSString *committed = tab.committedOrigin;
  if (committed.length && ![committed isEqualToString:launch]) return NO;
  NSString *url = tab.url;
  if (!url.length) return YES;
  if ([url isEqualToString:@"about:blank"]) return YES;
  NSString *live = OriginOfURL(url);
  if (![live isEqualToString:launch]) return NO;
  if (![live hasPrefix:@"https:"]) return YES;
  return ![tab.securityInfo[@"level"] isEqual:@"certificateError"];
}

BOOL ReleaseFocusFrom(NSView *page) {
  NSWindow *window = page.window;
  NSResponder *focused = window.firstResponder;
  if (!page || ![focused isKindOfClass:NSView.class] || ![(NSView *)focused isDescendantOf:page]) return NO;
  [window makeFirstResponder:nil];
  return YES;
}

}

namespace {

void PlaceVeil(UniVerseCoreTab *tab, UniVerseEarlyVeil *veil) {
  NSView *page = tab.view, *host = page.superview;
  if (!host || host == veil.view.superview) return;
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  if (!veil.view) {
    veil.view = [[NSView alloc] initWithFrame:host.bounds];
    veil.view.wantsLayer = YES;
    veil.view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  }
  NSColor *fill = [host isKindOfClass:UniVerseWebView.class] ? ((UniVerseWebView *)host).pageBackgroundColor : nil;
  veil.view.layer.backgroundColor = (fill ?: NSColor.windowBackgroundColor).CGColor;
  veil.view.frame = host.bounds;
  [host addSubview:veil.view positioned:NSWindowAbove relativeTo:page];
  [CATransaction commit];
  if (ReleaseFocusFrom(page)) veil.restoreFocus = YES;
}

void Unveil(UniVerseCoreTab *tab) {
  UniVerseEarlyVeil *veil = [Veils() objectForKey:tab];
  if (!veil) return;
  [Veils() removeObjectForKey:tab];
  NSView *host = veil.view.superview;
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  [veil.view removeFromSuperview];
  [CATransaction commit];
  if (!veil.restoreFocus || tab.closed || tab.view.superview != host || ![host isKindOfClass:UniVerseWebView.class]) return;
  UniVerseWebView *web = (UniVerseWebView *)host;
  NSWindow *window = web.window;
  NSResponder *focused = window.firstResponder;
  if (window.isVisible && !window.isMiniaturized && web.visible && !web.isHiddenOrHasHiddenAncestor && (!focused || focused == window)) [tab focus];
}

void Reconcile(UniVerseCoreTab *tab) {
  NSView *host = tab.view.superview;
  if ([host isKindOfClass:UniVerseWebView.class]) [UniVerseEarlyWindow page:tab shownURL:((UniVerseWebView *)host).shownURL];
}

void WatchVeil(UniVerseCoreTab *tab, UniVerseEarlyVeil *veil, double after) {
  __weak UniVerseCoreTab *weakTab = tab;
  __weak UniVerseEarlyVeil *weakVeil = veil;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(after * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    UniVerseCoreTab *page = weakTab;
    UniVerseEarlyVeil *still = weakVeil;
    if (!page || !still || [Veils() objectForKey:page] != still) return;
    if (still.armedGeneration != EmitsOf(page).generation || ![still.armedShown ?: @"" isEqualToString:still.lastShown ?: @""]) return;
    const double left = still.changedAt + kVeilFailSafeSeconds - CACurrentMediaTime();
    if (left > 0.05) return WatchVeil(page, still, left);
    NSLog(@"[universecore] page veil lifted %.1f s after the bar showed a URL the engine never sent: shown %@, committed %@, visible %@", kVeilFailSafeSeconds,
          still.lastShown ?: @"(none)", page.committedOrigin ?: @"(none)", page.url ?: @"(none)");
    Unveil(page);
  });
}

}

namespace universe_early_window {

void CarryShield(UniVerseCoreTab *tab, id inputBlock, NSString *shownAtPlacement) {
  if (!tab || tab.closed) return;
  UniVerseEarlyVeil *veil = [Veils() objectForKey:tab];
  if (!veil) {
    veil = [UniVerseEarlyVeil new];
    veil.lastShown = shownAtPlacement;
    veil.changedAt = CACurrentMediaTime();
    [Veils() setObject:veil forKey:tab];
  }
  if (!veil.inputBlock) veil.inputBlock = inputBlock ?: [tab suppressInput];
  PlaceVeil(tab, veil);
  Reconcile(tab);
}

}

@implementation UniVerseEarlyWindow (Pages)

+ (void)pageMoved:(UniVerseCoreTab *)tab {
  if (!tab) return;
  if (UniVerseEarlyVeil *veil = [Veils() objectForKey:tab]) {
    PlaceVeil(tab, veil);
    Reconcile(tab);
  }
  for (UniVerseEarlyShown *s in [Shown() copy]) {
    if (s.tab != tab || tab.view.superview == s.cover) continue;
    if (s.claimed) Forget(s);
    else if (s.expired) Abandon(s);
    else DropCover(s);
  }
}

+ (BOOL)veils:(UniVerseCoreTab *)tab {
  return tab && [Veils() objectForKey:tab] != nil;
}

+ (void)requestFocus:(UniVerseCoreTab *)tab {
  if (tab) [Veils() objectForKey:tab].restoreFocus = YES;
}

+ (void)page:(UniVerseCoreTab *)tab shownURL:(NSString *)url {
  if (!tab) return;
  UniVerseEarlyVeil *veil = [Veils() objectForKey:tab];
  if (veil && ![veil.lastShown ?: @"" isEqualToString:url ?: @""]) {
    veil.lastShown = url;
    veil.changedAt = CACurrentMediaTime();
    UniVersePageEmits *emits = EmitsOf(tab);
    const BOOL unknown = url.length && ![emits.current containsObject:url] && ![emits.older containsObject:url];
    if (unknown && !emits.forgot && emits.firstEmitAt > 0 && veil.changedAt > emits.firstEmitAt) {
      const BOOL armed = veil.armedGeneration == emits.generation && veil.armedShown;
      veil.armedGeneration = emits.generation;
      veil.armedShown = url;
      if (!armed) WatchVeil(tab, veil, kVeilFailSafeSeconds);
    } else {
      veil.armedShown = nil;
    }
  }
  const BOOL veiled = veil != nil;
  if (!veiled && ![Watched() containsObject:tab]) return;
  if (tab.closed) {
    [Watched() removeObject:tab];
    return Unveil(tab);
  }
  const BOOL matches = ShownMatches(url, tab);
  if (veiled) {
    if (matches) Unveil(tab);
    return;
  }
  if (!url.length) return;
  if (!matches) {
    [Watched() removeObject:tab];
    return CarryShield(tab, nil, url);
  }
  if (!tab.loading) [Watched() removeObject:tab];
}

+ (void)pageCommitted:(UniVerseCoreTab *)tab shownURL:(NSString *)url {
  if (!tab) return;
  UniVersePageEmits *emits = EmitsOf(tab);
  for (NSString *each in emits.current) Archive(emits, each);
  emits.generation++;
  [emits.current removeAllObjects];
  emits.firstEmitAt = 0;
  if (NSString *visible = tab.url; visible.length) [emits.current addObject:visible];
  if (UniVerseEarlyVeil *veil = [Veils() objectForKey:tab]) {
    veil.armedShown = nil;
    return Reconcile(tab);
  }
  if (!url.length || ShownMatches(url, tab)) return;
  CarryShield(tab, nil, url);
}

+ (void)page:(UniVerseCoreTab *)tab emitted:(NSString *)url {
  if (!tab || !url) return;
  UniVersePageEmits *emits = EmitsOf(tab);
  if (!emits.firstEmitAt) emits.firstEmitAt = CACurrentMediaTime();
  if ([emits.current containsObject:url]) return;
  [emits.current addObject:url];
  while (emits.current.count > kOlderEmitsKept) {
    Archive(emits, emits.current.firstObject);
    [emits.current removeObjectAtIndex:0];
  }
  if ([Veils() objectForKey:tab]) Reconcile(tab);
}

+ (void)pageNavigated:(UniVerseCoreTab *)tab launchURL:(NSString *)launchURL {
  if (!tab) return;
  for (UniVerseEarlyShown *s in Shown())
    if (s.tab == tab && !s.shielded && tab.view.superview == s.cover && !ShowsLaunchOrigin(tab, launchURL)) Shield(s);
}

+ (void)dropPage:(UniVerseCoreTab *)tab {
  if (!tab) return;
  [Watched() removeObject:tab];
  Unveil(tab);
  for (UniVerseEarlyShown *s in [Shown() copy])
    if (s.tab == tab) {
      if (s.claimed) Forget(s);
      else if (s.expired) Abandon(s);
      else DropCover(s);
    }
}

@end
