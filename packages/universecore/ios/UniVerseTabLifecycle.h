#import <Foundation/Foundation.h>

enum class UniVerseTabPhase { Waiting, Creating, Attached, Closing };

struct UniVerseTabLifecycle {
  UniVerseTabPhase phase{UniVerseTabPhase::Waiting};
  NSUInteger createEpoch{};
  NSString *pendingURL;
  BOOL pendingUserInitiated{};
  NSString *creatingURL;
  CFTimeInterval creatingAt{};
  NSString *transferredURL;
  BOOL handingOff{};
  BOOL moving{};
  BOOL offerClosed{};
  BOOL launchCloseSent{};

  bool closed() const { return phase == UniVerseTabPhase::Closing; }

  bool canCreate() const { return phase == UniVerseTabPhase::Waiting; }

  NSUInteger beginCreating() {
    phase = UniVerseTabPhase::Creating;
    return ++createEpoch;
  }

  bool isCurrent(NSUInteger epoch) const { return epoch == createEpoch && !closed(); }

  void resumeCreating() {
    if (phase == UniVerseTabPhase::Waiting) phase = UniVerseTabPhase::Creating;
  }

  void leaveCreating() {
    if (phase == UniVerseTabPhase::Creating) phase = UniVerseTabPhase::Waiting;
  }

  bool canAttach(bool hasTab) const { return !closed() && !hasTab; }

  void attached() { phase = UniVerseTabPhase::Attached; }

  void detached() {
    if (phase == UniVerseTabPhase::Attached) phase = UniVerseTabPhase::Waiting;
  }

  void handOff() { createEpoch++; }

  void close() {
    createEpoch++;
    phase = UniVerseTabPhase::Closing;
  }
};
