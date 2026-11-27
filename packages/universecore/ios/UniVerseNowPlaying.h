#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface UniVerseNowPlaying : NSObject

@property(nonatomic, readonly, nullable) NSString *frame;
@property(nonatomic, readonly, nullable) NSDictionary *selected;
@property(nonatomic, readonly) BOOL isEmpty;

- (nullable NSDictionary *)noteFrame:(NSString *)frame page:(nullable id)page main:(BOOL)main;
- (BOOL)reset;

@end

NS_ASSUME_NONNULL_END
