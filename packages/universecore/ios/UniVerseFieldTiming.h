#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#ifdef __cplusplus
extern "C" {
#endif

BOOL UniVerseFieldTimingEnabled(void);
double UniVerseFieldNow(void);
void UniVerseFieldMark(NSString *_Nullable key, NSString *kind, double at);
void UniVerseFieldMarkNow(NSString *_Nullable key, NSString *kind);
void UniVerseFieldMarkAtCommit(NSString *_Nullable key, NSString *kind);
void UniVerseWebViewsSetFieldTiming(BOOL on);

#ifdef __cplusplus
}
#endif

NS_ASSUME_NONNULL_END
