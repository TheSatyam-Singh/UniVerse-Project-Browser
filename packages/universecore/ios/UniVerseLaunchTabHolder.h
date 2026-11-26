#import "UniVerseTabParking.h"

@class UniVerseWebView;

@interface UniVerseLaunchTabHolder : NSObject <UniVerseParkedPageHolder>
@property (nonatomic, copy) NSString *url;
@property (nonatomic, copy) NSString *profile;
@property (nonatomic, readonly) BOOL closedByChrome;
- (void)replayTo:(UniVerseWebView *)view tab:(UniVerseCoreTab *)tab;
@end
