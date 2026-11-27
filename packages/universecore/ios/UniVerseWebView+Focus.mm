#import "UniVerseWebViewInternal.h"
#import "UniVerseEarlyWindow.h"

using namespace universe_web_view;

namespace {

constexpr CFTimeInterval kFocusRestoreWindow = 1;
}

@implementation UniVerseWebView (Focus)

static BOOL InTabPage(NSView *view) {
  for (NSView *v = view; v; v = v.superview)
    if ([v isKindOfClass:UniVerseWebView.class]) return !((UniVerseWebView *)v)->_standalone;
  return NO;
}

+ (void)keepOutgoingFocusFrom:(NSResponder *)responder {
  if (UniVerseWebView *view = [UniVerseWebView holding:responder]) {
    [view storePageFocusFrom:responder];
    view->_focus.keepsOutgoing = YES;
  }
}

+ (void)endOutgoingFocusFrom:(NSResponder *)responder {
  if (UniVerseWebView *view = [UniVerseWebView holding:responder]) view->_focus.keepsOutgoing = NO;
}

+ (UniVerseWebView *)holding:(id)responder {
  NSView *outgoing = [responder isKindOfClass:NSView.class] ? responder : nil;
  for (UniVerseWebView *view in LiveViews().allObjects)
    if (outgoing && view.window == outgoing.window && [outgoing isDescendantOf:view]) return view;
  return nil;
}

- (void)storePageFocus {
  NSResponder *responder = self.window.firstResponder;
  const BOOL unfocused = !responder || responder == self.window;
  const BOOL snapshotted = _focus.keepsOutgoing;
  _focus.keepsOutgoing = NO;
  if (snapshotted && unfocused) {
    _focus.onActivate = NO;
    return;
  }
  [self storePageFocusFrom:responder];
}

- (void)storePageFocusFrom:(NSResponder *)responder {
  _focus.onActivate = NO;
  _focus.devTools = nil;
  NSWindow *window = self.window;
  if (!window || !_tab) return;
  NSView *view = [responder isKindOfClass:NSView.class] ? (NSView *)responder : nil;
  if (view && _tab.view && [view isDescendantOf:_tab.view]) {
    _focus.page = UniVersePageFocus::Page;
  } else if (view && _devtoolsView && [view isDescendantOf:_devtoolsView]) {
    _focus.page = UniVersePageFocus::DevTools;
    _focus.devTools = view;
  } else if (!responder || responder == window || (view && InTabPage(view))) {
    _focus.page = UniVersePageFocus::Unknown;
  } else {
    _focus.page = UniVersePageFocus::Elsewhere;
  }
}

- (void)requestFocusRestore {
  [self requestFocusRestoreIn:self.window];
}

- (void)requestFocusRestoreIn:(NSWindow *)window {
  if (_standalone || !_tab || !window) return;
  _focus.onActivate = YES;
  _focus.activatedAt = CACurrentMediaTime();
  _focus.activatedIn = window;
  [self restoreFocusIfDue];
  if (_focus.onActivate) [self schedulePainting];
}

- (void)restoreFocusIfDue {
  if (!_focus.onActivate) return;
  NSWindow *window = self.window;
  NSView *page = _tab.view;
  if (!window || window != _focus.activatedIn || !page || _standalone || page.superview != self ||
      CACurrentMediaTime() - _focus.activatedAt > kFocusRestoreWindow) {
    _focus.onActivate = NO;
    return;
  }
  if (!_visible || page.isHiddenOrHasHiddenAncestor) return;
  [self takeFocusFromLingeringPane];
  _focus.onActivate = NO;
  NSResponder *responder = window.firstResponder;
  NSView *view = [responder isKindOfClass:NSView.class] ? (NSView *)responder : nil;
  if (view && [view isDescendantOf:self]) return;
  if (responder && responder != window && !(view && InTabPage(view))) return;
  NSView *devTools = _focus.devTools;
  if (_focus.page == UniVersePageFocus::DevTools && devTools.window == window && _devtoolsView && [devTools isDescendantOf:_devtoolsView]) {
    [window makeFirstResponder:devTools];
  } else if (_focus.page != UniVersePageFocus::Elsewhere) {
    [self focusPage];
  }
}

- (void)focusAfterLoad {
  if (_visible && _tab) [self focusPage];
}

- (void)focusPage {
  if ([UniVerseEarlyWindow veils:_tab]) return [UniVerseEarlyWindow requestFocus:_tab];
  [_tab focus];
}

- (void)tabDidGainFocus:(ArdiaCoreTab *)tab {
  [self emit:@"focus" payload:@{}];
}

@end
