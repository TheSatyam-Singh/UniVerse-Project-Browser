#import "UniVersePictureInPicture.h"
#import "UniVerseWebViewInternal.h"

#include <vector>

namespace universe_pip_throw {
struct Point;
struct Rect;
struct Screen;
}

@interface NSWindow (UniVersePreventsActivation)
- (void)_setPreventsActivation:(BOOL)prevents;
- (BOOL)_preventsActivation;
- (NSInteger)_resizeDirectionForMouseLocation:(NSPoint)location;
- (BOOL)_isNonactivatingPanel;
@end

namespace universe_pip {

constexpr CGFloat kPeek = 28;
constexpr CGFloat kReturnMargin = 16;
constexpr CGFloat kButtonMargin = 12, kButtonSize = 28;
constexpr CFTimeInterval kCornerBendDuration = 0.2;
constexpr CGFloat kRimAlpha = 0.17;

}

typedef NS_ENUM(NSInteger, UniVersePiPEdge) { UniVersePiPEdgeNone = 0, UniVersePiPEdgeLeft = -1, UniVersePiPEdgeRight = 1 };

@interface UniVersePiPControl : NSView
@property (nonatomic, copy) void (^onClick)(void);
@property (nonatomic) BOOL hovered;
@end

@interface UniVersePiPHandle : UniVersePiPControl
@property (nonatomic) UniVersePiPEdge edge;
@end

@interface UniVersePiPOverlay : NSView
@property (nonatomic, readonly) UniVersePiPHandle *handle;
@end

@interface UniVersePiPController : NSObject
@property (nonatomic, readonly) NSWindow *window;
@property (nonatomic, weak) UniVerseWebView *view;
@property (nonatomic, copy) NSString *host;
@property (nonatomic, readonly) UniVersePiPOverlay *overlay;
@property (nonatomic, readonly) UniVersePiPEdge stashedEdge;
@property (nonatomic) BOOL keepOnTop;
+ (instancetype)forWindow:(NSWindow *)window;
- (instancetype)initWithWindow:(NSWindow *)window;
- (void)roundCorners;
- (CGFloat)cornerRadius;
- (void)backToTab;
- (void)unstash;
- (NSMenu *)menu;
- (void)stopMotion;
- (void)abandonSwipe;
- (NSScreen *)gestureHome;
- (void)dragReleasedAt:(NSPoint)pointer velocity:(NSPoint)velocity;
- (NSDictionary *)throwInfo;
@end

@interface UniVersePiPController () {
  NSWindow *_window;
  __weak UniVerseWebView *_view;
  NSString *_host;
  UniVersePiPOverlay *_overlay;
  UniVersePiPEdge _stashedEdge;
  BOOL _keepOnTop;
  NSMutableArray *_observers;
  NSTimer *_slide;
  BOOL _animating;
  BOOL _sawDrag;
  BOOL _swiping;
  NSPoint _swipeGrab;
  NSPoint _swipeLastDelta;
  NSPoint _swipePointer;
  CFTimeInterval _swipeBeganAt;
  NSTimeInterval _swipeLastAt;
  NSRect _swipeStart;
  NSDictionary *_lastRelease;
  NSDictionary *_lastSwipe;
  NSMutableDictionary *_lastThrow;
  NSDictionary *_lastScreenFit;
  __weak NSScreen *_lastScreen;
  __weak NSScreen *_swipeHome;
  __weak NSScreen *_stashScreen;
}
- (void)detach;
- (void)toggleKeepOnTop:(id)sender;
- (void)backToTabFromMenu:(id)sender;
- (void)windowMoved;
- (void)fitCorners:(BOOL)animated;
- (void)bendCornersTo:(CGFloat)radius animated:(BOOL)animated;
- (void)screenChanged;
- (NSScreen *)homeScreen;
- (UniVersePiPEdge)edgeBeyond;
- (BOOL)throwFrom:(NSPoint)grab velocity:(NSPoint)velocity;
- (void)throwTo:(NSRect)target velocity:(NSPoint)velocity corner:(int)corner;
- (void)settle;
- (void)rescueIfLost;
- (NSRect)frameStashedAt:(UniVersePiPEdge)edge;
- (void)stashAt:(UniVersePiPEdge)edge;
- (void)animateTo:(NSRect)target;
- (void)swipeBegan:(NSEvent *)event;
- (void)moveBy:(universe_pip_throw::Point)delta;
- (void)swipeMoved:(NSEvent *)event;
- (void)swipeEnded:(NSEvent *)event cancelled:(BOOL)cancelled;
@end

@interface UniVersePiPController (Workspaces)
@end

@interface UniVersePiPController (Placement)
@end

@interface UniVersePiPController (Swipe)
+ (BOOL)handleSwipe:(NSEvent *)event;
+ (void)abandonSwipeOn:(NSWindow *)window;
- (void)devSwipe:(NSArray<NSString *> *)args;
- (void)devDrag:(NSArray<NSString *> *)args;
@end

@interface UniVersePiPController (SelfTest)
- (NSString *)snapshot:(NSString *)name;
- (void)runSelfTest;
- (void)runButtonSelfTest:(NSString *)button;
- (void)runHoverSelfTest;
- (void)devMouse:(NSArray<NSString *> *)args;
@end

@interface UniVersePiPZoom : NSObject
+ (BOOL)handle:(NSEvent *)event;
@end

namespace universe_pip {

extern NSString *const kZoomDefault;
extern const void *const kZoomKey;
BOOL IsChromeFloatingWindow(NSWindow *window);
BOOL IsChromeVideoPictureInPicture(NSWindow *window);
BOOL IsChromeDocumentPictureInPicture(NSWindow *window);
BOOL JoinsFullScreenSpaces(NSWindow *window);
void JoinFullScreenSpaces(NSWindow *window);
NSScreen *ScreenFor(NSRect frame);
void PreventActivation(NSWindow *window);
BOOL PreventsActivation(NSWindow *window);
extern NSInteger gActivations;
void ActivateApp(NSString *why);
BOOL ThrowEnabled();
NSPoint PointerOf(NSEvent *event);
universe_pip_throw::Rect ThrowRect(NSRect r);
int ScreenIndex(NSScreen *screen);
std::vector<universe_pip_throw::Screen> ThrowScreens();

}
