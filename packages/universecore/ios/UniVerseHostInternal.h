#import "UniVerseInternal.h"
#import "UniVerseLaunchSequence.h"

@interface UniVerseBootstrapDelegate : NSObject <NSApplicationDelegate>
@property(nonatomic, readonly) NSMutableArray<NSURL *> *urls;
@end

@interface UniVerseHostEngineDelegate : NSObject <UniVerseCoreEngineDelegate>
@end

namespace universe_host {

extern id<NSApplicationDelegate> (^gMakeDelegate)(void);
extern id<NSApplicationDelegate> gAppDelegate;
extern NSString *gDataDirectory;
void WatchReservedShortcuts();
NSMutableDictionary<NSString *, UniVerseCoreProfile *> *Profiles();
NSMutableDictionary<NSString *, NSMutableArray *> *ProfileWaiters();
NSMutableSet<NSString *> *DeletedProfiles();
NSMutableSet<NSString *> *ReleasedPrivateNames();
NSMutableDictionary<NSString *, void (^)(UniVerseCoreProfile *)> *DeletionsAfterLoad();
NSArray<NSString *> *LoadedDataProfileNames();
NSString *InstalledDataDirectory();
bool IsTeamSigned();
extern UniVerseBootstrapDelegate *gBootstrap;
extern bool gScratchDataDir;
extern NSMutableDictionary<NSString *, NSDictionary *> *gInstallPrompts;
void LinksArrived(NSArray<NSURL *> *urls);
void ReplayLaunchURLs(NSArray<NSURL *> *urls);
void StartLaunchTab();
void StartEarlyWindow();

}
