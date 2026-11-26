#import "UniVersePictureInPictureInternal.h"
#import "UniVerseChromeWindowHost.h"

#import <objc/runtime.h>
#import <QuartzCore/QuartzCore.h>

using namespace universe_pip;

@implementation UniVersePiPOverlay

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.wantsLayer = YES;
    self.layer.zPosition = 100;
    self.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    _handle = [[UniVersePiPHandle alloc] initWithFrame:NSZeroRect];
    _handle.hidden = YES;
    _handle.alphaValue = 0;
    [self addSubview:_handle];
  }
  return self;
}

- (BOOL)isFlipped { return YES; }

- (NSView *)hitTest:(NSPoint)point {
  NSPoint local = [self convertPoint:point fromView:self.superview];
  if (!_handle.hidden && NSPointInRect(local, _handle.frame)) return _handle;
  return nil;
}

- (void)layout {
  [super layout];
  NSSize size = self.bounds.size;
  _handle.frame = _handle.edge == UniVersePiPEdgeLeft ? NSMakeRect(size.width - kPeek, 0, kPeek, size.height)
                                                 : NSMakeRect(0, 0, kPeek, size.height);
}

@end
