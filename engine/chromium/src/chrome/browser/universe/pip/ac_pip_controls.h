// Copyright 2026 UniVerse. Apache-2.0.

#ifndef CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_CONTROLS_H_
#define CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_CONTROLS_H_

#include <optional>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/timer/timer.h"
#include "chrome/browser/ui/views/overlay/back_to_tab_button.h"
#include "chrome/browser/ui/views/overlay/close_image_button.h"
#include "chrome/browser/ui/views/overlay/overlay_controls_fade_animation.h"
#include "chrome/browser/ui/views/overlay/playback_image_button.h"
#include "services/media_session/public/cpp/media_position.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/view.h"

namespace gfx {
class Canvas;
}

inline constexpr int kUniVersePipButtonMargin = 12;
inline constexpr int kUniVersePipButtonSize = 28;

void SetUniVersePipButtonDrawnNatively(views::View* button, bool natively);

class UniVerseBackToTabButton : public OverlayWindowBackToTabButton {
  METADATA_HEADER(UniVerseBackToTabButton, OverlayWindowBackToTabButton)

 public:
  explicit UniVerseBackToTabButton(PressedCallback callback);
  UniVerseBackToTabButton(const UniVerseBackToTabButton&) = delete;
  UniVerseBackToTabButton& operator=(const UniVerseBackToTabButton&) = delete;
  ~UniVerseBackToTabButton() override;

  void Place(const gfx::Size& window_size);

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class UniVerseCloseButton : public CloseImageButton {
  METADATA_HEADER(UniVerseCloseButton, CloseImageButton)

 public:
  static constexpr int kWidth = 29;

  explicit UniVerseCloseButton(PressedCallback callback);
  UniVerseCloseButton(const UniVerseCloseButton&) = delete;
  UniVerseCloseButton& operator=(const UniVerseCloseButton&) = delete;
  ~UniVerseCloseButton() override;

  void Place(const gfx::Size& window_size);

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class UniVersePlaybackButton : public PlaybackImageButton {
  METADATA_HEADER(UniVersePlaybackButton, PlaybackImageButton)

 public:
  explicit UniVersePlaybackButton(PressedCallback callback);
  UniVersePlaybackButton(const UniVersePlaybackButton&) = delete;
  UniVersePlaybackButton& operator=(const UniVersePlaybackButton&) = delete;
  ~UniVersePlaybackButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class UniVerseProgressBar : public views::View {
  METADATA_HEADER(UniVerseProgressBar, views::View)

 public:
  static constexpr int kSlopX = 4;
  static constexpr int kSlopY = 6;
  static constexpr float kBarHeight = 5;

  explicit UniVerseProgressBar(base::RepeatingCallback<void(double)> seek);
  UniVerseProgressBar(const UniVerseProgressBar&) = delete;
  UniVerseProgressBar& operator=(const UniVerseProgressBar&) = delete;
  ~UniVerseProgressBar() override;

  void SetMediaPosition(const media_session::MediaPosition& position);

  void Place(const gfx::Size& window_size);

  void OnPaint(gfx::Canvas* canvas) override;
  bool OnMousePressed(const ui::MouseEvent& event) override;
  bool OnMouseDragged(const ui::MouseEvent& event) override;
  void OnMouseReleased(const ui::MouseEvent& event) override;
  void OnMouseCaptureLost() override;
  ui::Cursor GetCursor(const ui::MouseEvent& event) override;

 private:
  double FractionAt(int x) const;
  void RepaintIfDrawn();

  base::RepeatingCallback<void(double)> seek_;
  media_session::MediaPosition position_;
  std::optional<double> drag_fraction_;
  bool dragging_ = false;
  base::RepeatingTimer timer_;
};

class UniVerseControlsFadeAnimation : public OverlayControlsFadeAnimation {
 public:
  UniVerseControlsFadeAnimation(
      const std::vector<raw_ptr<views::View>>& controls,
      Type type,
      base::RepeatingClosure on_step);
  UniVerseControlsFadeAnimation(const UniVerseControlsFadeAnimation&) =
      delete;
  UniVerseControlsFadeAnimation& operator=(
      const UniVerseControlsFadeAnimation&) = delete;
  ~UniVerseControlsFadeAnimation() override;

  void AnimateToState(double state) override;

 private:
  base::RepeatingClosure on_step_;
};

#endif
