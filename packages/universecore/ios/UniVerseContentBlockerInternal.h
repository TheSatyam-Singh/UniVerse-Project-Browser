#import "UniVerseInternal.h"
#import "UniVerseContentBlocker.h"
#import "UniVerseServices.h"

@interface UniVerseContentBlockerPage : NSObject <UniVerseCoreTabDelegate>
@property(readonly) UniVerseCoreTab *tab;
@property(readonly) NSString *origin;
@property(readonly) BOOL dead;
- (instancetype)initWithTab:(UniVerseCoreTab *)tab origin:(NSString *)origin;
- (BOOL)onOwnPage;
- (void)run:(NSString *)script completion:(void (^)(id value, NSString *error))completion;
- (void)leftOwnPage;
- (void)next;
- (void)fail:(NSString *)error;
@end

namespace universe_content_blocker {

NSString *ExtensionId();
extern NSString *const kLiteId;
extern NSString *const kLiteReaderName;
extern NSString *const kLiteMovedMarker;
extern bool gFailNextMessage;
NSString *ScriptWith(NSString *format, NSArray *args);
extern NSString *const kProfile;
NSMutableOrderedSet<NSString *> *LoadedProfiles();
NSMutableDictionary<NSString *, UniVerseContentBlockerPage *> *Pages();
UniVerseContentBlockerPage *HiddenPage(NSString *key, NSString *profile, UniVerseCoreProfile *p, NSString *extensionId, NSString *file);
bool IsHiddenPageWindow(NSWindow *window);
void LoadIntoProfile(NSString *profile, void (^then)(NSString *error));
extern NSString *const kOffDirective;
void Call(NSString *profile, NSString *expression, void (^completion)(id value, NSString *error));
bool LiteSettingsPending(UniVerseCoreProfile *p);
void MoveLiteSettings(NSString *profile, UniVerseCoreProfile *p, void (^done)(void));

}
