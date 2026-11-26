#ifndef UNIVERSE_CORE_AC_SAFE_STORAGE_H_
#define UNIVERSE_CORE_AC_SAFE_STORAGE_H_

namespace base {
class CommandLine;
}

namespace universecore {

void GuardSafeStorageKey(const base::CommandLine& command_line);

}

#endif
