#import "UniVersePictureInPictureInternal.h"
#import "UniVersePiPThrowMath.h"
#import "UniVerseRuntime.h"

namespace {

BOOL WhereTheThrowMathsMayPutIt(NSRect rect) {
  const auto screens = universe_pip::ThrowScreens();
  return !screens.empty() && universe_pip_throw::Shortfall(universe_pip::ThrowRect(rect), screens.data(), (int)screens.size()) <= 1e-9;
}

}

@implementation UniVersePiPController (Placement)

+ (void)load {
  SEL constrain = @selector(constrainFrameRect:toScreen:);
  universe_runtime::ReplaceMethod(NSClassFromString(@"NativeWidgetMacFramelessNSWindow"), constrain, ^id(IMP original) {
    return ^NSRect(NSWindow *window, NSRect rect, NSScreen *screen) {
      if ([UniVersePiPController forWindow:window] && WhereTheThrowMathsMayPutIt(rect)) return rect;
      return ((NSRect (*)(id, SEL, NSRect, NSScreen *))original)(window, constrain, rect, screen);
    };
  });
}

@end
