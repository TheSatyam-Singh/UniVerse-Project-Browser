#ifndef UNIVERSE_CORE_AC_PAGE_VIEW_H_
#define UNIVERSE_CORE_AC_PAGE_VIEW_H_

#import <Cocoa/Cocoa.h>

@protocol RenderWidgetHostViewMacDelegate;

namespace content {
class RenderWidgetHost;
}

namespace universecore {

NSObject<RenderWidgetHostViewMacDelegate>* CreatePageViewDelegate(
    content::RenderWidgetHost* host);

}

#endif
