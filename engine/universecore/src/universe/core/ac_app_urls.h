#ifndef UNIVERSE_CORE_AC_APP_URLS_H_
#define UNIVERSE_CORE_AC_APP_URLS_H_

class GURL;

namespace content {
class NavigationThrottleRegistry;
class WebContents;
}

namespace universecore {

void AddAppSchemeThrottle(content::NavigationThrottleRegistry& registry);
bool InterceptAppURL(content::WebContents* source,
                     const GURL& url,
                     bool user_gesture);

}

#endif
