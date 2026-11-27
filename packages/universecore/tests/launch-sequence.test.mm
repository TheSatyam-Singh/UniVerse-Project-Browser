#import "../ios/UniVerseLaunchSequence.h"

#include <cstdio>
#include <string>
#include <vector>

static int failures = 0;
#define CHECK(cond)                                                \
  do {                                                             \
    if (!(cond)) {                                                 \
      std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);  \
      failures++;                                                  \
    }                                                              \
  } while (0)

struct Host {
  UniVerseLaunchSequence *launch = [UniVerseLaunchSequence new];
  std::vector<std::string> log;

  void run() {
    UniVerseLaunchSequence *l = launch;
    std::vector<std::string> *out = &log;
    [l after:UniVerseLaunchEngineStarted | UniVerseLaunchAppKitDidFinish
          do:^{
            out->push_back(std::string("earlyWindow") + (l.launchedHidden ? " hidden" : "") + (l.launchedForDocuments ? " documents" : ""));
          }];
  }

  void engineStarted() {
    launch.engineRunning = YES;
    log.push_back("setup");
    [launch reach:UniVerseLaunchEngineStarted];
  }

  void launchApp(bool urls) {
    std::vector<std::string> *out = &log;
    if (urls) [launch after:UniVerseLaunchJSStarted do:^{ out->push_back("parkLinks"); }];
    if (![launch reached:UniVerseLaunchAppKitDidFinish]) {
      if (urls) [launch after:UniVerseLaunchAppKitDidFinish do:^{ out->push_back("deliverURLs"); }];
      return;
    }
    if (urls) log.push_back("deliverURLs");
  }

  void appKitFinished(bool hidden = false, bool documents = false) { [launch appKitFinishedHidden:hidden forDocuments:documents]; }

  void jsStarted() {
    [launch reach:UniVerseLaunchJSStarted];
    log.push_back("launchTab");
  }
};

static bool Is(const std::vector<std::string> &log, std::vector<std::string> expected) { return log == expected; }

int main() {
  @autoreleasepool {
    {
      Host h;
      h.run();
      h.engineStarted();
      CHECK(Is(h.log, {"setup"}));
      h.launchApp(false);
      h.appKitFinished();
      h.jsStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow", "launchTab"}));
    }
    {
      Host h;
      h.run();
      h.appKitFinished();
      CHECK(h.log.empty());
      h.engineStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow"}));
      h.launchApp(true);
      h.jsStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow", "deliverURLs", "parkLinks", "launchTab"}));
    }
    {
      Host h;
      h.run();
      h.engineStarted();
      h.launchApp(true);
      CHECK(Is(h.log, {"setup"}));
      h.appKitFinished();
      CHECK(Is(h.log, {"setup", "earlyWindow", "deliverURLs"}));
      h.jsStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow", "deliverURLs", "parkLinks", "launchTab"}));
    }
    {
      Host h;
      h.run();
      h.engineStarted();
      h.appKitFinished();
      h.jsStarted();
      h.launchApp(true);
      CHECK(Is(h.log, {"setup", "earlyWindow", "launchTab", "parkLinks", "deliverURLs"}));
    }
    {
      Host h;
      h.run();
      h.engineStarted();
      h.appKitFinished(true, false);
      h.jsStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow hidden", "launchTab"}));
    }
    {
      Host h;
      h.run();
      h.appKitFinished(false, true);
      h.engineStarted();
      CHECK(Is(h.log, {"setup", "earlyWindow documents"}));
    }
    {
      UniVerseLaunchSequence *l = [UniVerseLaunchSequence new];
      __block int outer = 0, inner = 0;
      [l after:UniVerseLaunchEngineStarted
            do:^{
              outer++;
              [l after:UniVerseLaunchEngineStarted do:^{ inner++; }];
              [l reach:UniVerseLaunchEngineStarted];
            }];
      [l reach:UniVerseLaunchEngineStarted];
      [l reach:UniVerseLaunchEngineStarted];
      CHECK(outer == 1 && inner == 1);
    }
    {
      UniVerseLaunchSequence *l = [UniVerseLaunchSequence new];
      __block int ran = 0;
      l.engineRunning = YES;
      [l after:UniVerseLaunchJSStarted do:^{ ran++; }];
      [l engineShutDown];
      [l reach:UniVerseLaunchJSStarted];
      [l after:0 do:^{ ran++; }];
      CHECK(ran == 0 && !l.engineRunning && ![l reached:UniVerseLaunchJSStarted]);
    }
  }
  if (failures) return 1;
  std::printf("launch-sequence: ok\n");
  return 0;
}
