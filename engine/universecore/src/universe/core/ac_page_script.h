#ifndef UNIVERSE_CORE_AC_PAGE_SCRIPT_H_
#define UNIVERSE_CORE_AC_PAGE_SCRIPT_H_

#include <string>

namespace content {
class RenderProcessHost;
}

namespace universecore {

void SetPageScript(const std::string& script);
const std::string& GetPageScript();
void SendPageScript(content::RenderProcessHost* host);

}

#endif
