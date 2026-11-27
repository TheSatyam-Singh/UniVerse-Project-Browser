#import "UniVerseChromeWindowHost.h"
#import "UniVerseInternal.h"

@interface UniVersePageDrawWait : NSObject
+ (void)tab:(UniVerseCoreTab *)tab draws:(NSInteger (^)(BOOL fullScreen, BOOL fills))test then:(void (^)(void))done;
@end

@interface UniVersePageCover : NSView
@property(readonly, weak) UniVerseCoreTab *tab;
+ (void)coverTabs:(NSArray<UniVerseCoreTab *> *)tabs then:(void (^)(NSArray<UniVersePageCover *> *covers))then;
- (void)repicture;
- (void)uncover:(BOOL)fade;
@end

@interface UniVersePopupOriginStrip : NSView
- (void)showURL:(NSString *)url security:(NSString *)level;
@end

@interface UniVerseWindowFullScreen : NSObject
+ (instancetype)ofWindow:(UniVerseCoreWindow *)coreWindow create:(BOOL)create;
- (void)tab:(UniVerseCoreTab *)tab fullScreen:(BOOL)fullScreen tell:(void (^)(void))tell;
- (BOOL)seen;
- (BOOL)seenOnlyByWindowServer;
- (void)reconsiderSight;
- (NSDictionary *)state;
- (UniVerseCoreTab *)probedTab;
- (BOOL)covered;
- (NSInteger)covers;
- (BOOL)transitioning;
- (BOOL)pageFullScreen;
- (BOOL)enteredForPage;
@end

namespace universe_window {

NSMapTable<NSWindow *, UniVerseWindowController *> *Controllers();
extern BOOL (^gRefusesUnhandledKey)(NSWindow *, NSEvent *);

void ConfigureWindow(NSWindow *window);
CGFloat WindowCornerRadius(NSWindow *window);
extern const void *kLightsCenterKey;
extern const void *kLightsShownKey;
extern const void *kLightsMoveKey;
extern const void *kLightsTrailingKey;
NSArray<NSButton *> *TrafficLightButtons(NSWindow *window);
NSPoint LightsCenter(NSWindow *window, NSValue *center, NSSize size);
void TranslateTrafficLights(NSWindow *window, CGFloat dx);
void RetileTrafficLights(NSWindow *window);
bool MoveTrafficLights(NSWindow *window, NSValue *center);

NSMenuItem *ReservedMenuItemForEvent(NSEvent *event);
bool IsReservedKey(NSEvent *event);
bool IsSecondSidebarKeyPress(NSEvent *event);
bool KeepsUnhandledSidebarKeyInPage(NSWindow *window, NSEvent *event);

extern const void *kActedFullScreenKey;
extern const void *kWindowFullScreenKey;
BOOL IsWindowFullScreen(NSWindow *window);
void ActOcclusion(NSWindow *window, NSNumber *visible);
void ActWindowServer(NSWindow *window, BOOL shows);
extern NSTimeInterval gActedOcclusionGap;
void ActWindowFullScreen(UniVerseCoreWindow *coreWindow, BOOL enter, NSTimeInterval seconds);
extern NSTimeInterval gActedTransition;
NSMapTable<UniVerseCoreTab *, NSNumber *> *FullScreenChanges();

extern BOOL gPageCoverOff;

NSString *PopupOriginText(NSString *url);

}
