#import "UniVerseCore.h"

@class UniVerseWebView;

NS_ASSUME_NONNULL_BEGIN

@interface UniVerseTabRegistry : NSObject
+ (void)setView:(nullable UniVerseWebView *)view forTab:(UniVerseCoreTab *)tab;
+ (nullable UniVerseWebView *)viewForTab:(UniVerseCoreTab *)tab;
+ (NSString *)offerTab:(UniVerseCoreTab *)tab;
+ (NSString *)offerTab:(UniVerseCoreTab *)tab prefix:(NSString *)prefix;
+ (nullable UniVerseCoreTab *)takeOffered:(NSString *)adoptId;
+ (nullable UniVerseCoreTab *)offeredTab:(NSString *)adoptId;
+ (void)forget:(UniVerseCoreTab *)tab;
@end

NS_ASSUME_NONNULL_END
