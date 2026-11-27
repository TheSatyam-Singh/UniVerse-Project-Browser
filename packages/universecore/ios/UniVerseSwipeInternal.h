#import "UniVerseSwipe.h"
#import "UniVerseCore.h"

namespace universe_swipe {

enum class RendererScroll { Idle, AwaitingBegin, AwaitingFirstUpdate, FirstUpdateUnconsumed, FirstUpdateConsumed };

}

@interface UniVerseRendererScroll : NSObject
- (void)reset;
@property (nonatomic) universe_swipe::RendererScroll scroll;
@property (nonatomic) BOOL overscrolled;
@property (nonatomic) BOOL overscrollAllowed;
@end

namespace universe_swipe {

enum class State { Idle, Pending, Tracking, Ignored };

struct Gesture {
  State state = State::Idle;
  __weak NSView<UniVerseSwipeTarget> *target;
  __weak UniVerseRendererScroll *renderer;
  __weak NSView *hit;
  BOOL rendererHit = NO;
  CGFloat dx = 0, dy = 0;
  int direction = 0;
  BOOL available = NO;
  NSTimeInterval times[6] = {};
  CGFloat deltas[6] = {};
  int samples = 0;
  BOOL ignoreSystemPreference = NO;
  int seq = 0;
  int emitted = 0;
  NSTimeInterval time = 0;
};

}

namespace universe_swipe {

extern NSMutableArray *gTrace;
extern BOOL gWrongRendererHit;
extern BOOL gLegacyHitRouting;
extern Gesture gGesture;
NSEvent *HandleScroll(NSEvent *event, NSWindow *window, NSPoint location, BOOL ignoreSystemPreference);
BOOL HandleDiscreteSwipe(NSWindow *window, NSPoint location, CGFloat deltaX);

NSArray *RectValue(NSRect r);
NSHashTable<NSView<UniVerseSwipeTarget> *> *Targets();
NSView *PageViewOf(NSView *hit);
UniVerseRendererScroll *RendererScrollFor(NSView *hit);
NSView *HitView(NSWindow *window, NSPoint locationInWindow);
NSView<UniVerseSwipeTarget> *TargetAt(NSWindow *window, NSPoint locationInWindow, NSView *hit, NSMutableArray *why = nil);
NSArray *HitChain(NSView *hit);
BOOL IsPager(NSView<UniVerseSwipeTarget> *target);
BOOL HasNativePager(NSView<UniVerseSwipeTarget> *target);
NSView *FirstRenderer(NSView *view);
NSView *ReactRoot(NSView *view, NSWindow *window);
NSView<UniVerseSwipeTarget> *MisroutedRendererTarget(NSWindow *window, NSPoint location, NSView *hit);
NSView *ResolveHit(NSWindow *window, NSPoint location, NSView<UniVerseSwipeTarget> *__strong *target, BOOL *fallback);
BOOL NativeContentScrolls(NSView *hit, NSView *container, int direction);
NSArray *NativeScrollReport(NSView *hit, NSView *container);

}
