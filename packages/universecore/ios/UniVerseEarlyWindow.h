#import <AppKit/AppKit.h>

@class UniVerseCoreTab;
@class UniVerseSavedSession;

NS_ASSUME_NONNULL_BEGIN

@interface UniVerseEarlyWindow : NSObject
+ (void)setDataDirectory:(nullable NSString *)directory;
+ (void)noteLayoutChangeIn:(nullable NSWindow *)window;
+ (void)recordNow;
+ (void)prefetchForSession:(nullable UniVerseSavedSession *)session;
+ (void)discardPrefetch;
+ (BOOL)canShowWindow:(NSString *)windowId session:(UniVerseSavedSession *)session;
+ (BOOL)showWindow:(NSString *)windowId
             frame:(NSArray<NSNumber *> *)frame
               key:(NSString *)key
           profile:(NSString *)profile
          backdrop:(NSDictionary *)backdrop;
+ (void)attachPage:(UniVerseCoreTab *)tab key:(NSString *)key;
+ (BOOL)showLittleWindowForLink:(UniVerseCoreTab *)tab
                           mark:(NSString *)mark
                            url:(NSString *)url
                          frame:(NSArray<NSNumber *> *)frame
                        profile:(NSString *)profile
                       backdrop:(NSDictionary *)backdrop
                       settings:(NSDictionary *)settings
                           like:(nullable NSString *)windowId;
+ (nullable NSWindow *)claimLittleWindowForLink:(NSString *)mark profile:(nullable NSString *)profile;
+ (void)forgetPictures;
+ (void)forgetPicturesNow;
+ (BOOL)holdsPage:(UniVerseCoreTab *)tab;
+ (nullable NSWindow *)claimForAppWindow:(nullable NSString *)windowId profile:(nullable NSString *)profile;
+ (BOOL)takeDismissed:(nullable NSString *)windowId;
+ (nullable NSView *)coverInWindow:(nullable NSWindow *)window;
+ (void)rootEmbedded:(NSView *)root inWindow:(NSWindow *)window;
@end

@interface UniVerseEarlyWindow (Pages)
+ (void)pageMoved:(UniVerseCoreTab *)tab;
+ (void)pageNavigated:(nullable UniVerseCoreTab *)tab launchURL:(nullable NSString *)launchURL;
+ (BOOL)veils:(nullable UniVerseCoreTab *)tab;
+ (void)requestFocus:(nullable UniVerseCoreTab *)tab;
+ (void)page:(nullable UniVerseCoreTab *)tab shownURL:(nullable NSString *)url;
+ (void)pageCommitted:(nullable UniVerseCoreTab *)tab shownURL:(nullable NSString *)url;
+ (void)page:(nullable UniVerseCoreTab *)tab emitted:(nullable NSString *)url;
+ (void)dropPage:(nullable UniVerseCoreTab *)tab;
@end

NS_ASSUME_NONNULL_END
