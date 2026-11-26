#import "UniVerseSwipeInternal.h"

#import <objc/runtime.h>

using namespace universe_swipe;

@interface UniVerseRendererScroll ()
- (void)acked:(UniVerseCorePageScrollAck)ack consumed:(BOOL)consumed;
- (void)overscrolledAllowingHorizontal:(BOOL)allowed;
@end

@implementation UniVerseRendererScroll

- (void)reset {
  _scroll = RendererScroll::AwaitingBegin;
  _overscrolled = NO;
  _overscrollAllowed = NO;
}

- (void)acked:(UniVerseCorePageScrollAck)ack consumed:(BOOL)consumed {
  if (ack == UniVerseCorePageScrollAckBegin) {
    if (_scroll == RendererScroll::AwaitingBegin) _scroll = RendererScroll::AwaitingFirstUpdate;
  } else if (_scroll == RendererScroll::AwaitingFirstUpdate) {
    _scroll = consumed ? RendererScroll::FirstUpdateConsumed : RendererScroll::FirstUpdateUnconsumed;
  }
}

- (void)overscrolledAllowingHorizontal:(BOOL)allowed {
  _overscrolled = YES;
  _overscrollAllowed = allowed;
}

@end

@interface UniVerseRendererScrollAcks : NSObject <UniVerseCorePageScrollObserver>
@end

namespace {

const void *const kRendererScrollKey = &kRendererScrollKey;

UniVerseRendererScroll *ExistingScroll(NSView *page) {
  return objc_getAssociatedObject(page, kRendererScrollKey);
}

}

@implementation UniVerseRendererScrollAcks

- (void)pageView:(NSView *)view ackedScroll:(UniVerseCorePageScrollAck)ack consumed:(BOOL)consumed {
  if (gTrace) [gTrace addObject:@{@"ack" : @"gesture", @"kind" : ack == UniVerseCorePageScrollAckBegin ? @"begin" : @"update", @"consumed" : @(consumed)}];
  [ExistingScroll(view) acked:ack consumed:consumed];
}

- (void)pageView:(NSView *)view overscrolledAllowingHorizontal:(BOOL)allowed {
  if (gTrace) [gTrace addObject:@{@"ack" : @"overscroll", @"allowsX" : @(allowed)}];
  [ExistingScroll(view) overscrolledAllowingHorizontal:allowed];
}

@end

namespace universe_swipe {

NSView *PageViewOf(NSView *hit) {
  for (NSView *v = hit; v; v = v.superview)
    if ([UniVerseCorePageView isPageView:v]) return v;
  return nil;
}

UniVerseRendererScroll *RendererScrollFor(NSView *hit) {
  static UniVerseRendererScrollAcks *acks;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    acks = [UniVerseRendererScrollAcks new];
    [UniVerseCorePageView setScrollObserver:acks];
  });
  NSView *page = PageViewOf(hit);
  if (!page || ![UniVerseCorePageView takeSwipes:page]) return nil;
  UniVerseRendererScroll *scroll = ExistingScroll(page);
  if (!scroll) {
    scroll = [UniVerseRendererScroll new];
    objc_setAssociatedObject(page, kRendererScrollKey, scroll, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return scroll;
}

}
