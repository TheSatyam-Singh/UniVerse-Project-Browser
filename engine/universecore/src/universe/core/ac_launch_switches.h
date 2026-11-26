#ifndef UNIVERSE_CORE_AC_LAUNCH_SWITCHES_H_
#define UNIVERSE_CORE_AC_LAUNCH_SWITCHES_H_

#include <optional>
#include <string>
#include <string_view>

namespace universecore {

inline constexpr char kBackgroundSwitch[] = "universe-background";
inline constexpr char kDataDirSwitch[] = "universe-data-dir";
inline constexpr char kTestSwitch[] = "universe-test";
inline constexpr char kTraceSwitch[] = "universe-trace";
inline constexpr char kSwitchesSwitch[] = "universe-switches";

bool BackgroundInstance();

std::optional<std::string> InstanceValue(std::string_view key);

bool SignedForDistribution();

bool TestInstance();

std::optional<std::string> TestValue(std::string_view key);

bool TestFlag(std::string_view key);

bool Traced(std::string_view area);

std::optional<bool> SwitchOverride(std::string_view name);

bool SwitchOn(std::string_view name);

void DecideTestGateAtStartup();

}

#endif
