// Copyright 2026 UniVerse. Apache-2.0.

#ifndef UNIVERSE_CORE_AC_VIDEO_UPSCALING_H_
#define UNIVERSE_CORE_AC_VIDEO_UPSCALING_H_

#include <optional>

@class NSDictionary;

namespace universecore {

void StartVideoUpscaling();

void SetVideoUpscalingEnabled(bool enabled);

void SetVideoUpscalingTestConditions(std::optional<bool> low_power,
                                     std::optional<bool> thermal_pressure);

void VideoUpscalingInputsChanged();

NSDictionary* VideoUpscalingState();

}

#endif
