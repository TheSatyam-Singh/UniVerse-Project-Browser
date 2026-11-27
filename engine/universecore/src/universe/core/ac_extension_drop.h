#ifndef UNIVERSE_CORE_AC_EXTENSION_DROP_H_
#define UNIVERSE_CORE_AC_EXTENSION_DROP_H_

namespace content {
struct DropData;
class WebContents;
}

namespace universecore {

bool InstallDroppedExtensions(content::WebContents* contents,
                              const content::DropData& drop);

}

#endif
