#ifndef UNIVERSE_CORE_AC_CONTEXT_MENU_H_
#define UNIVERSE_CORE_AC_CONTEXT_MENU_H_

#include <memory>

namespace content {
class WebContents;
class WebContentsViewDelegate;
}

namespace universecore {

std::unique_ptr<content::WebContentsViewDelegate> CreateViewDelegate(
    content::WebContents* contents);

}

#endif
