#ifndef UNIVERSE_CORE_AC_LIFETIME_H_
#define UNIVERSE_CORE_AC_LIFETIME_H_

namespace universecore {

void InstallAppOverrides();

void StartLifetimeObservers();

void QuitEngine();
bool IsQuitting();

void HostQuitCancelled();

}

#endif
