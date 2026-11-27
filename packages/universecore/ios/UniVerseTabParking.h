#import "UniVerseInternal.h"

NS_ASSUME_NONNULL_BEGIN

@protocol UniVerseParkedPageHolder <UniVerseCoreTabDelegate>
@property(nonatomic, readonly) BOOL closedByChrome;
@end

@interface UniVerseTabParking : NSObject

+ (void)park:(ArdiaCoreTab *)tab forKey:(NSString *)key;
+ (nullable ArdiaCoreTab *)parkedTabForKey:(NSString *)key;
+ (void)unpark:(NSString *)key;
+ (void)tookTransfer:(NSString *)key;
+ (void)releaseTransfer:(NSString *)key;
+ (BOOL)launchWasClosed:(NSString *)key;
+ (BOOL)rehomeFromWindow:(UniVerseWindowController *)closing;

+ (void)keepOffscreen:(ArdiaCoreTab *)tab holder:(id<UniVerseParkedPageHolder>)holder;
+ (nullable id<UniVerseParkedPageHolder>)takeHolderOfTab:(ArdiaCoreTab *)tab;

+ (void)holdAcrossReload:(NSDictionary<NSString *, ArdiaCoreTab *> *)tabs
                 expired:(void (^)(NSString *key, ArdiaCoreTab *tab))expired;

@property(class, nonatomic, readonly, nullable) ArdiaCoreTab *launchTab;
+ (void)holdLaunchTab:(NSString *)key
                  url:(NSString *)url
              profile:(NSString *)profile
              opening:(ArdiaCoreTab *_Nullable (^)(void))open;
+ (void)claimLaunchTab:(NSString *)key url:(NSString *)url profile:(NSString *)profile;

@property(class, nonatomic, readonly, nullable) ArdiaCoreTab *firstLinkTab;
+ (void)holdLinkTabs:(NSArray<NSString *> *)urls profile:(NSString *)profile opening:(ArdiaCoreTab *_Nullable (^)(NSString *url))open;
+ (nullable NSString *)linkMarkForTab:(ArdiaCoreTab *)tab;
+ (void)dismissLinkTab:(ArdiaCoreTab *)tab;
+ (BOOL)takeDismissedLinkMark:(NSString *)mark;
+ (NSDictionary<NSString *, id> *)routeLinkTabs:(NSArray<NSString *> *)urls;
+ (nullable ArdiaCoreTab *)parkLinkTab:(NSString *)mark forKey:(nullable NSString *)key;
+ (void)discardTab:(ArdiaCoreTab *)tab forKey:(NSString *)key;

@end

NS_ASSUME_NONNULL_END
