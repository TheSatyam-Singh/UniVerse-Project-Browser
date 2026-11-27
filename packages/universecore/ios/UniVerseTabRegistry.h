#import "UniVerseCore.h"

@class UniVerseWebView;

NS_ASSUME_NONNULL_BEGIN

@interface UniVerseTabRegistry : NSObject
+ (void)setView:(nullable UniVerseWebView *)view forTab:(ArdiaCoreTab *)tab;
+ (nullable UniVerseWebView *)viewForTab:(ArdiaCoreTab *)tab;
+ (NSString *)offerTab:(ArdiaCoreTab *)tab;
+ (NSString *)offerTab:(ArdiaCoreTab *)tab prefix:(NSString *)prefix;
+ (nullable ArdiaCoreTab *)takeOffered:(NSString *)adoptId;
+ (nullable ArdiaCoreTab *)offeredTab:(NSString *)adoptId;
+ (void)forget:(ArdiaCoreTab *)tab;
@end

NS_ASSUME_NONNULL_END
