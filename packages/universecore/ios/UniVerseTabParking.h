#import "UniVerseInternal.h"

NS_ASSUME_NONNULL_BEGIN

@protocol UniVerseParkedPageHolder <UniVerseCoreTabDelegate>
@property(nonatomic, readonly) BOOL closedByChrome;
@end

@interface UniVerseTabParking : NSObject

+ (void)park:(UniVerseCoreTab *)tab forKey:(NSString *)key;
+ (nullable UniVerseCoreTab *)parkedTabForKey:(NSString *)key;
+ (void)unpark:(NSString *)key;
+ (void)tookTransfer:(NSString *)key;
+ (void)releaseTransfer:(NSString *)key;
+ (BOOL)launchWasClosed:(NSString *)key;
+ (BOOL)rehomeFromWindow:(UniVerseWindowController *)closing;

+ (void)keepOffscreen:(UniVerseCoreTab *)tab holder:(id<UniVerseParkedPageHolder>)holder;
+ (nullable id<UniVerseParkedPageHolder>)takeHolderOfTab:(UniVerseCoreTab *)tab;

+ (void)holdAcrossReload:(NSDictionary<NSString *, UniVerseCoreTab *> *)tabs
                 expired:(void (^)(NSString *key, UniVerseCoreTab *tab))expired;

@property(class, nonatomic, readonly, nullable) UniVerseCoreTab *launchTab;
+ (void)holdLaunchTab:(NSString *)key
                  url:(NSString *)url
              profile:(NSString *)profile
              opening:(UniVerseCoreTab *_Nullable (^)(void))open;
+ (void)claimLaunchTab:(NSString *)key url:(NSString *)url profile:(NSString *)profile;

@property(class, nonatomic, readonly, nullable) UniVerseCoreTab *firstLinkTab;
+ (void)holdLinkTabs:(NSArray<NSString *> *)urls profile:(NSString *)profile opening:(UniVerseCoreTab *_Nullable (^)(NSString *url))open;
+ (nullable NSString *)linkMarkForTab:(UniVerseCoreTab *)tab;
+ (void)dismissLinkTab:(UniVerseCoreTab *)tab;
+ (BOOL)takeDismissedLinkMark:(NSString *)mark;
+ (NSDictionary<NSString *, id> *)routeLinkTabs:(NSArray<NSString *> *)urls;
+ (nullable UniVerseCoreTab *)parkLinkTab:(NSString *)mark forKey:(nullable NSString *)key;
+ (void)discardTab:(UniVerseCoreTab *)tab forKey:(NSString *)key;

@end

NS_ASSUME_NONNULL_END
