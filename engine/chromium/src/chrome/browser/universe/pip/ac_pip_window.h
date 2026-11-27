// Copyright 2026 UniVerse. Apache-2.0.

#ifndef CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_WINDOW_H_
#define CHROME_BROWSER_UNIVERSE_PIP_AC_PIP_WINDOW_H_

#include <memory>
#include <vector>

#include "base/callback_list.h"
#include "base/memory/raw_ptr.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/ui/views/overlay/video_overlay_window_views.h"

class UniVerseProgressBar;

namespace content {
class VideoPictureInPictureWindowController;
}

class UniVerseVideoOverlayWindow : public VideoOverlayWindowViews {
 public:
  explicit UniVerseVideoOverlayWindow(
      content::VideoPictureInPictureWindowController* controller);
  UniVerseVideoOverlayWindow(const UniVerseVideoOverlayWindow&) = delete;
  UniVerseVideoOverlayWindow& operator=(const UniVerseVideoOverlayWindow&) =
      delete;
  ~UniVerseVideoOverlayWindow() override;

  void ShowInactive() override;
  void Hide() override;
  void SetMediaPosition(const media_session::MediaPosition& position) override;
  void OnNativeWidgetMove() override;
  void OnNativeWidgetDestroyed() override;
  void OnNativeWidgetSizeChanged(const gfx::Size& new_size) override;
  void OnUpdateControlsBounds() override;
  void UpdateControlsVisibility(bool is_visible, bool should_animate) override;
  gfx::Rect GetProgressViewBounds() override;

 private:
  gfx::Rect CalculateAndUpdateWindowBounds() override;
  void SetUpViews() override;

  void OnCloseButtonPressed();
  void HideIdleControlsUnlessPointerOnControl();
  void MaybeSaveBounds();
  void FinishHide();
  void PresentNativeControls();

  raw_ptr<UniVerseProgressBar> ac_progress_bar_ = nullptr;
  base::TimeDelta ac_hide_fade_;
  base::OneShotTimer ac_hide_timer_;
  std::vector<base::CallbackListSubscription> ac_button_state_subscriptions_;
};

std::unique_ptr<VideoOverlayWindowViews> NewUniVerseVideoOverlayWindow(
    content::VideoPictureInPictureWindowController* controller);

#endif
