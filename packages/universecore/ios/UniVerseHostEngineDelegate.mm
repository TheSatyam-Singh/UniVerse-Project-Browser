#import "UniVerseHostInternal.h"
#import "UniVerseEarlyWindow.h"
#import "UniVerseServices.h"
#import "UniVerseNavigationDownloads.h"
#import "UniVerseStartup.h"
#import "UniVerseTabParking.h"
#import "UniVerseWebViewInternal.h"

#import <Security/Security.h>
#import <objc/runtime.h>

#include <cctype>
#include <cstring>
#include <set>
#include <string>
#include <vector>

using namespace universe_host;

@implementation UniVerseHostEngineDelegate

- (void)engineDidStart {
  UniVerseLaunchSequence.shared.engineStartedAt = NSDate.date.timeIntervalSince1970 * 1000;
  NSLog(@"[universecore] engine started (Chromium %@)", ArdiaCoreEngine.sharedEngine.chromiumVersion);
  UniVerseLaunchSequence.shared.engineRunning = YES;
  WatchReservedShortcuts();
  universe_host::InstallActivationGuardsLate();
  if (gScratchDataDir && universe_host::Background())
    universe_host::InstallTestCrashGuard([gDataDirectory stringByDeletingLastPathComponent]);
  ArdiaCoreEngine *engine = ArdiaCoreEngine.sharedEngine;
  if (UniVerseCoreProfile *profile = universe_host::PersonalIfLoaded(engine)) Profiles()[@""] = profile;
  universe_host::LoadContentBlocker(@"");
  [UniVerseWebView installScrollZoom];
  [UniVerseWebView installSwitchPrewarm];
  [UniVerseWebView removeSharedImages];
  [UniVerseServices watchDownloads:@""];

  NSBundle *bundle = [NSBundle bundleForClass:UniVerseHostEngineDelegate.class];
  NSString *path = [bundle pathForResource:@"page_script" ofType:@"js"];
  NSString *script = path ? [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil] : nil;
  if (script) engine.pageScript = script;
  [UniVerseLaunchSequence.shared reach:UniVerseLaunchEngineStarted];

  CFRunLoopObserverRef idle = CFRunLoopObserverCreateWithHandler(
      nullptr, kCFRunLoopBeforeWaiting, false, 0, ^(CFRunLoopObserverRef observer, CFRunLoopActivity) {
        CFRunLoopRemoveObserver(CFRunLoopGetMain(), observer, kCFRunLoopCommonModes);
        __block id started = [NSNotificationCenter.defaultCenter
            addObserverForName:@"RCTJavaScriptWillStartExecutingNotification"
                        object:nil
                         queue:nil
                    usingBlock:^(NSNotification *) {
                      [NSNotificationCenter.defaultCenter removeObserver:started];
                      started = nil;
                      dispatch_async(dispatch_get_main_queue(), ^{ StartLaunchTab(); });
                    }];
        [self launchApp];
      });
  CFRunLoopAddObserver(CFRunLoopGetMain(), idle, kCFRunLoopCommonModes);
  CFRelease(idle);
}

- (void)launchApp {
  UniVerseLaunchSequence.shared.reactNativeStartedAt = NSDate.date.timeIntervalSince1970 * 1000;
  NSArray<NSURL *> *launchURLs = gBootstrap.urls.copy;
  LinksArrived(launchURLs);
  gAppDelegate = gMakeDelegate();
  const SEL openURLs = @selector(application:openURLs:);
  if (Method open = class_getInstanceMethod([gAppDelegate class], openURLs)) {
    IMP original = method_getImplementation(open);
    method_setImplementation(open, imp_implementationWithBlock(^(id delegate, NSApplication *app, NSArray<NSURL *> *urls) {
      LinksArrived(urls);
      ((void (*)(id, SEL, NSApplication *, NSArray<NSURL *> *))original)(delegate, openURLs, app, urls);
    }));
  }
  NSApp.delegate = gAppDelegate;
  gBootstrap = nil;
  NSNotification *note = [NSNotification notificationWithName:NSApplicationWillFinishLaunchingNotification object:NSApp];
  UniVerseLaunchSequence *launch = UniVerseLaunchSequence.shared;
  if ([launch reached:UniVerseLaunchAppKitWillFinish] && [gAppDelegate respondsToSelector:@selector(applicationWillFinishLaunching:)])
    [gAppDelegate applicationWillFinishLaunching:note];
  if (![launch reached:UniVerseLaunchAppKitDidFinish]) {
    NSLog(@"[universecore] app delegate %@ set before AppKit finished launching", NSStringFromClass([gAppDelegate class]));
    if (launchURLs.count)
      [launch after:UniVerseLaunchAppKitDidFinish
                 do:^{
                   dispatch_async(dispatch_get_main_queue(), ^{ ReplayLaunchURLs(launchURLs); });
                 }];
    return;
  }
  note = [NSNotification notificationWithName:NSApplicationDidFinishLaunchingNotification object:NSApp];
  if ([gAppDelegate respondsToSelector:@selector(applicationDidFinishLaunching:)])
    [gAppDelegate applicationDidFinishLaunching:note];
  NSLog(@"[universecore] app delegate %@ launched", NSStringFromClass([gAppDelegate class]));
  if (launchURLs.count) ReplayLaunchURLs(launchURLs);
}

- (void)engineWillShutDown {
  [UniVerseLaunchSequence.shared engineShutDown];
}

- (void)engineQuitCancelled {
  NSLog(@"[universecore] quit cancelled");
  if (UniVerseHost.quitCancelledHandler) UniVerseHost.quitCancelledHandler();
}

- (void)engine:(ArdiaCoreEngine *)engine permissionRequest:(NSDictionary *)request tab:(ArdiaCoreTab *)tab {
  if (tab && universe_host::AskPermissionInPopupWindow(tab, request)) return;
  NSMutableDictionary *payload = [request mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  if (tab && !universe_host::AppTabIdOf(tab)) return universe_host::HoldUntilHosted(tab, @"permissions.requested", payload);
  [UniVerseEvents emit:@"permissions.requested" data:payload];
}

- (void)engine:(ArdiaCoreEngine *)engine deviceChooser:(NSDictionary *)chooser tab:(ArdiaCoreTab *)tab {
  NSMutableDictionary *payload = [chooser mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  if ([UniVerseEvents listens:@"media"]) [UniVerseEvents emit:@"media.deviceChooser" data:payload];
  else if ([payload[@"open"] boolValue])
    [ArdiaCoreEngine cancelDeviceChooser:[payload[@"id"] intValue]];
}

- (void)engine:(ArdiaCoreEngine *)engine castDialog:(NSDictionary *)dialog tab:(ArdiaCoreTab *)tab {
  NSMutableDictionary *payload = [dialog mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  if ([UniVerseEvents listens:@"media"]) [UniVerseEvents emit:@"media.castDialog" data:payload];
  else if ([payload[@"open"] boolValue])
    [ArdiaCoreEngine closeCastDialog:[payload[@"id"] intValue]];
}

- (void)engine:(ArdiaCoreEngine *)engine castRoutes:(NSArray *)routes profile:(UniVerseCoreProfile *)profile {
  if (![UniVerseEvents listens:@"media"]) return;
  NSMutableArray<NSString *> *names = [NSMutableArray array];
  if (profile.offTheRecord)
    for (NSString *name in universe_host::LoadedProfileNames())
      if (universe_host::LoadedProfile(name) == profile) [names addObject:name];
  if (!names.count) [names addObject:universe_host::ProfileName(profile)];
  for (NSString *name in names) [UniVerseEvents emit:@"media.castRoutes" data:@{@"profile" : name, @"routes" : routes ?: @[]}];
}

- (void)engine:(ArdiaCoreEngine *)engine extensionSidePanel:(NSDictionary *)panel tab:(ArdiaCoreTab *)tab {
  NSMutableDictionary *payload = [panel mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  [UniVerseEvents emit:@"extensions.sidePanel" data:payload];
}

- (BOOL)engine:(ArdiaCoreEngine *)engine extensionActionPopup:(NSDictionary *)popup tab:(ArdiaCoreTab *)tab {
  if (![UniVerseEvents listens:@"extensions"] || !tab) {
    NSLog(@"[universecore] action.openPopup for %@: %@", popup[@"extensionId"], tab ? @"the app isn't listening yet" : @"no tab");
    return NO;
  }
  NSMutableDictionary *payload = [popup mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  [UniVerseEvents emit:@"extensions.actionPopup" data:payload];
  return YES;
}

- (BOOL)engineIsReservedKey:(NSString *)key unshiftedKey:(NSString *)unshiftedKey modifiers:(NSEventModifierFlags)modifiers {
  return universe_host::IsReservedBinding(key, unshiftedKey, modifiers);
}

- (BOOL)engineIsReservedKeyEvent:(NSEvent *)event {
  return event.type == NSEventTypeKeyDown && universe_host::IsReservedKeyEvent(event);
}

- (BOOL)engine:(ArdiaCoreEngine *)engine extensionActionShortcut:(NSDictionary *)shortcut tab:(ArdiaCoreTab *)tab {
  if (![UniVerseEvents listens:@"extensions"] || !tab) return NO;
  NSMutableDictionary *payload = [shortcut mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  [UniVerseEvents emit:@"extensions.actionShortcut" data:payload];
  return YES;
}

- (void)engine:(ArdiaCoreEngine *)engine
    extensionInstallPrompt:(NSDictionary *)prompt
                   profile:(UniVerseCoreProfile *)profile
                       tab:(ArdiaCoreTab *)tab {
  NSMutableDictionary *payload = [prompt mutableCopy];
  payload[@"tabId"] = universe_host::AppTabIdValue(tab);
  payload[@"profile"] = universe_host::ProfileName(profile);
  gInstallPrompts[payload[@"requestId"] ?: @""] = payload;
  [UniVerseEvents emit:@"extensions.installPrompt" data:payload];
}

- (void)engine:(ArdiaCoreEngine *)engine extensionInstallFailed:(NSString *)message tab:(ArdiaCoreTab *)tab {
  [UniVerseEvents emit:@"extensions.installFailed" data:@{@"message" : message ?: @"", @"tabId" : universe_host::AppTabIdValue(tab)}];
}

- (void)engine:(ArdiaCoreEngine *)engine permissionRequestDismissed:(NSString *)requestId {
  universe_host::DropPopupWindowPermission(requestId ?: @"");
  universe_host::DropHeldEvent(@"permissions.requested", requestId ?: @"");
  [UniVerseEvents emit:@"permissions.dismissed" data:@{@"id" : requestId ?: @""}];
}

- (ArdiaCoreWindow *)engineWindowForNewBrowserOfProfile:(UniVerseCoreProfile *)profile type:(NSString *)type {
  if (![type isEqualToString:@"normal"] && ![type isEqualToString:@"popup"]) return nil;
  if ([type isEqualToString:@"popup"]) return universe_host::PopupWindowForChromeBrowser(profile);
  if (!profile.offTheRecord)
    if (UniVerseWindowController *made = [UniVerseWindowController chromeMadeWindowForProfile:profile]) return made.coreWindow;
  return [UniVerseWindowController strayWindowForProfile:profile].coreWindow;
}

@end
