#import "UniVerseHostInternal.h"
#import "UniVerseEarlyWindow.h"
#import "UniVerseEvents.h"
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

namespace universe_host {

NSMutableDictionary<NSString *, UniVerseCoreProfile *> *Profiles() {
  static NSMutableDictionary *profiles = [NSMutableDictionary dictionary];
  return profiles;
}

NSMutableDictionary<NSString *, NSMutableArray *> *ProfileWaiters() {
  static NSMutableDictionary *waiters = [NSMutableDictionary dictionary];
  return waiters;
}

NSMutableSet<NSString *> *DeletedProfiles() {
  static NSMutableSet *deleted = [NSMutableSet set];
  return deleted;
}

NSMutableSet<NSString *> *ReleasedPrivateNames() {
  static NSMutableSet *released = [NSMutableSet set];
  return released;
}

NSMutableDictionary<NSString *, void (^)(UniVerseCoreProfile *)> *DeletionsAfterLoad() {
  static NSMutableDictionary *deletions = [NSMutableDictionary dictionary];
  return deletions;
}

}

namespace {

void RememberProfile(NSString *name, UniVerseCoreProfile *profile) {
  const BOOL fresh = Profiles()[name] != profile;
  Profiles()[name] = profile;
  if (fresh && !profile.offTheRecord && !IsPrivateSessionId(name)) [UniVerseEvents emit:@"profiles.loaded" data:@{@"profile" : name}];
}

NSString *DirectoryName(NSString *name) {
  if (name.length && ([name isEqualToString:@"Default"] || [name hasPrefix:@"Profile "])) return nil;
  return universe_host::ProfileDirectoryName(name);
}

}

namespace universe_host {

NSString *InstalledDataDirectory() {
  NSString *support = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject;
  NSString *bundleId = NSBundle.mainBundle.bundleIdentifier ?: @"com.universe.projectbrowser";
  return [[support stringByAppendingPathComponent:bundleId] stringByAppendingPathComponent:@"Chromium"];
}

}

namespace universe_host {

void ForgetDestroyedProfiles() {
  for (NSString *name in Profiles().allKeys)
    if (Profiles()[name].destroyed) [Profiles() removeObjectForKey:name];
}

NSArray<NSString *> *LoadedProfileNames() {
  ForgetDestroyedProfiles();
  return Profiles().allKeys;
}

NSArray<NSString *> *LoadedDataProfileNames() {
  NSMutableArray<NSString *> *names = [NSMutableArray array];
  for (NSString *name in LoadedProfileNames())
    if (!IsPrivateSessionId(name) && !Profiles()[name].offTheRecord) [names addObject:name];
  return names;
}

NSArray<UniVerseCoreProfile *> *LoadedProfiles() {
  ForgetDestroyedProfiles();
  NSMutableArray *profiles = [NSMutableArray array];
  for (UniVerseCoreProfile *profile in Profiles().allValues)
    if (![profiles containsObject:profile]) [profiles addObject:profile];
  return profiles;
}

NSString *ProfileDirectoryName(NSString *name) {
  return name.length ? [@"Profile " stringByAppendingString:name] : @"Default";
}

NSString *ProfileNameOfDirectoryName(NSString *directory) {
  return [directory hasPrefix:@"Profile "] ? [directory substringFromIndex:8] : @"";
}

bool IsPrivateSessionId(NSString *name) {
  return [name hasPrefix:@"incognito"];
}

bool IsPrivateProfile(NSString *name) {
  UniVerseCoreProfile *loaded = name.length ? LoadedProfile(name) : nil;
  return loaded ? loaded.offTheRecord : IsPrivateSessionId(name);
}

NSString *OriginalProfileName(NSString *name) {
  if (!IsPrivateSessionId(name)) return name ?: @"";
  NSRange at = [name rangeOfString:@"@"];
  return at.location == NSNotFound ? @"" : [name substringFromIndex:NSMaxRange(at)];
}

NSString *OriginalProfileNameOf(UniVerseCoreProfile *profile) {
  if (!profile.offTheRecord) return ProfileName(profile);
  return ProfileNameOfDirectoryName(profile.name);
}

bool IsOffTheRecordOf(UniVerseCoreProfile *profile, NSString *name) {
  return profile.offTheRecord && IsPrivateSessionId(name) &&
         [profile.name isEqualToString:DirectoryName(OriginalProfileName(name))];
}

bool IsDeletedProfile(NSString *name) {
  return [DeletedProfiles() containsObject:name ?: @""];
}

UniVerseCoreProfile *LoadedProfile(NSString *name) {
  UniVerseCoreProfile *profile = Profiles()[name ?: @""];
  if (!profile.destroyed) return profile;
  [Profiles() removeObjectForKey:name ?: @""];
  return nil;
}

namespace {

void WithPrivateProfile(NSString *name, void (^completion)(UniVerseCoreProfile *)) {
  if ([ReleasedPrivateNames() containsObject:name]) return completion(nil);
  if (NSMutableArray *waiters = ProfileWaiters()[name]) return (void)[waiters addObject:completion];
  ProfileWaiters()[name] = [NSMutableArray arrayWithObject:completion];
  NSString *original = OriginalProfileName(name);
  WithProfile(original, ^(UniVerseCoreProfile *base) {
    ArdiaCoreEngine *engine = ArdiaCoreEngine.sharedEngine;
    void (^answer)(UniVerseCoreProfile *, NSString *) = ^(UniVerseCoreProfile *otr, NSString *error) {
      NSArray *pending = ProfileWaiters()[name];
      [ProfileWaiters() removeObjectForKey:name];
      if (IsDeletedProfile(original)) {
        if (otr && ![Profiles().allValues containsObject:otr]) [engine releaseProfile:otr];
        if (pending) NSLog(@"[universecore] no private profile for %@: its profile was deleted", name);
        for (void (^waiter)(UniVerseCoreProfile *) in pending) waiter(nil);
        return;
      }
      if (!pending) {
        if (otr && ![Profiles().allValues containsObject:otr]) [engine releaseProfile:otr];
        return;
      }
      if (otr && !otr.destroyed) Profiles()[name] = otr;
      else NSLog(@"[universecore] no private profile for %@: %@", name, error ?: @"it went");
      for (void (^waiter)(UniVerseCoreProfile *) in pending) waiter(Profiles()[name]);
    };
    if (!base) return answer(nil, [NSString stringWithFormat:@"profile \"%@\" isn't loaded", original]);
    [engine offTheRecordProfileFor:base completion:answer];
  });
}

}

void WithProfile(NSString *name, void (^completion)(UniVerseCoreProfile *)) {
  name = name ?: @"";
  if ([DeletedProfiles() containsObject:name]) return completion(nil);
  if (UniVerseCoreProfile *profile = LoadedProfile(name)) return completion(profile);
  ArdiaCoreEngine *engine = ArdiaCoreEngine.sharedEngine;
  if (!engine) return completion(nil);
  if (IsPrivateSessionId(name)) return WithPrivateProfile(name, [completion copy]);
  if (name.length == 0) {
    if (UniVerseCoreProfile *personal = PersonalIfLoaded(engine)) {
      RememberProfile(@"", personal);
      return completion(personal);
    }
  }
  NSString *directory = DirectoryName(name);
  if (!directory) {
    NSLog(@"[universecore] no profile named \"%@\": that's a Chromium folder name, not a profile", name);
    return completion(nil);
  }
  NSMutableArray *waiters = ProfileWaiters()[name];
  if (waiters) return (void)[waiters addObject:[completion copy]];
  ProfileWaiters()[name] = [NSMutableArray arrayWithObject:[completion copy]];
  [engine loadProfile:directory
           completion:^(UniVerseCoreProfile *loaded) {
             NSArray *pending = ProfileWaiters()[name];
             [ProfileWaiters() removeObjectForKey:name];
             if (void (^deletion)(UniVerseCoreProfile *) = DeletionsAfterLoad()[name]) {
               [DeletionsAfterLoad() removeObjectForKey:name];
               deletion(loaded);
             }
             UniVerseCoreProfile *profile = [DeletedProfiles() containsObject:name] ? nil : loaded;
             if (profile) RememberProfile(name, profile);
             if (profile) universe_host::LoadContentBlocker(name);
             if (profile) [UniVerseServices watchDownloads:name];
             for (void (^waiter)(UniVerseCoreProfile *) in pending) waiter(profile);
           }];
}

UniVerseCoreProfile *PersonalIfLoaded(ArdiaCoreEngine *engine) {
  UniVerseCoreProfile *profile = engine.defaultProfile;
  return [profile.name isEqualToString:@"Default"] ? profile : nil;
}

NSString *ProfileName(UniVerseCoreProfile *profile) {
  if (!profile) return @"";
  for (NSString *name in Profiles())
    if (Profiles()[name] == profile) return name;
  return ProfileNameOfDirectoryName(profile.name);
}

NSString *AppDisposition(NSString *chrome) {
  static NSDictionary *map = @{
    @"foreground_tab" : @"foreground",
    @"background_tab" : @"background",
    @"popup" : @"popup",
    @"window" : @"window",
    @"off_the_record" : @"incognito",
    @"current_tab" : @"current",
    @"split_view" : @"split",
    @"singleton_tab" : @"foreground",
  };
  return map[chrome] ?: @"foreground";
}

}
