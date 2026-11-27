#ifndef UNIVERSE_CORE_UNIVERSECORE_TAB_INTERNAL_H_
#define UNIVERSE_CORE_UNIVERSECORE_TAB_INTERNAL_H_

#import <AppKit/AppKit.h>

#import "universe/core/public/UniVerseCore.h"
#include "base/memory/raw_ptr.h"

class SkBitmap;

namespace content {
class WebContents;
}

namespace universecore {
CGImageRef CreatePicture(const SkBitmap& bitmap);
}

@interface UniVerseCoreTab () {
  raw_ptr<content::WebContents> _contents;
  int _browserId;
  NSColor* __strong _pageBackgroundColor;
}
@end

#endif
