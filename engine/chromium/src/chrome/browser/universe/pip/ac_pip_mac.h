// Copyright 2026 UniVerse. Apache-2.0.

#ifndef CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_MAC_H_
#define CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_MAC_H_

#include <optional>
#include <vector>

#include "base/time/time.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/native_ui_types.h"

std::optional<gfx::Rect> LoadUniVersePictureInPictureBounds();
void SaveUniVersePictureInPictureBounds(const gfx::Rect& bounds);

void FadeOutUniVersePictureInPicture(gfx::NativeWindow window,
                                      base::TimeDelta duration);
void ResetUniVersePictureInPictureFade(gfx::NativeWindow window);

struct UniVersePipNativeControl {
  const char* name;
  gfx::Rect bounds;
  bool hovered;
  bool pressed;
  float opacity;
};

bool PresentUniVersePictureInPictureControls(
    gfx::NativeWindow window,
    const std::vector<UniVersePipNativeControl>& controls);

#endif
