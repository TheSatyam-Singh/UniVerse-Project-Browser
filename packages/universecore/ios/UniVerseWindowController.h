#import "UniVerseCore.h"

@class UniVerseWebView;

NS_ASSUME_NONNULL_BEGIN

@interface UniVerseWindowController : NSObject <UniVerseCoreWindowDelegate>
+ (nullable UniVerseWindowController *)forNSWindow:(nullable NSWindow *)window;
+ (NSArray<UniVerseWindowController *> *)all;
@property(nonatomic, readonly) UniVerseCoreWindow *coreWindow;
@property(nonatomic, strong, nullable) NSView *root;
@property(nonatomic) NSInteger hostChanges;
@property(nonatomic, copy, nullable) NSString *appWindowId;
+ (UniVerseWindowController *)strayWindowForProfile:(UniVerseCoreProfile *)profile;
+ (nullable UniVerseWindowController *)chromeMadeWindowForProfile:(UniVerseCoreProfile *)profile;
@property(nonatomic, readonly) BOOL stray;
+ (UniVerseWindowController *)standaloneWindowForProfile:(UniVerseCoreProfile *)profile;
@property(nonatomic, readonly) BOOL standalone;
- (void)noteClosing:(UniVerseCoreTab *)tab;
+ (nullable UniVerseWindowController *)holding:(UniVerseCoreTab *)tab;
+ (nullable UniVerseWebView *)hostingViewForProfile:(nullable UniVerseCoreProfile *)profile;
+ (BOOL)userSees:(nullable NSWindow *)window;
+ (BOOL)userSeesOnlyThroughWindowServer:(nullable NSWindow *)window;
+ (void)reconsiderSightOf:(nullable NSWindow *)window;
+ (nullable instancetype)claimChromeMadeWindow:(nullable NSString *)token;
- (instancetype)initWithCoreWindow:(UniVerseCoreWindow *)coreWindow;
@end
extern NSNotificationName const UniVerseWindowSeenDidChange;
extern NSString *const UniVerseWindowSeenLeftAppKey;

NS_ASSUME_NONNULL_END
