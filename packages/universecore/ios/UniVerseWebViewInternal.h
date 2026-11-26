#import "UniVerseInternal.h"
#import "UniVerseWebView.h"
#import "UniVerseNowPlaying.h"
#import "UniVerseTabLifecycle.h"

enum class UniVersePageFocus { Unknown, Page, DevTools, Elsewhere };

@class UniVerseWebView;

struct UniVerseRequests {
  BOOL loadedOnce{};
  NSString *requestedURL;
};

struct UniVerseSentReports {
  BOOL navigationQueued{};
  NSDictionary *navigation;
  NSString *favicon;
  NSUInteger blockedGeneration{};
  BOOL blockedEmitQueued{};
  CFTimeInterval progressAt{};
  double progress{};
  BOOL progressQueued{};
};

struct UniVerseLeave {
  BOOL active{};
  NSUInteger generation{};
};

struct UniVerseFrameHold {
  BOOL awaiting{};
  NSUInteger generation{};
  NSArray *mark;
  __weak NSView *pane;
  CGFloat paneZ{};
  BOOL holding{};
  __weak UniVerseWebView *holdingFor;
  NSUInteger holdGeneration{};
  __weak UniVerseWebView *tookOverFrom;
  CFTimeInterval tookOverAt{};
};

struct UniVerseStandIn {
  __weak NSView *page;
  UniVerseCoreTab *tab;
  __weak UniVerseWebView *lender;
  BOOL closes{};
  BOOL leaving{};
  float opacity{};
  NSUInteger generation{};
  __weak UniVerseWebView *lentTo;
};

struct UniVerseLittlePage {
  BOOL held{};
  BOOL settled{};
  float opacity{};
  NSUInteger generation{};
};

struct UniVerseReveal {
  BOOL active{};
  NSUInteger generation{};
  __weak NSView *loweredPane;
  CGFloat loweredPaneZ{};
  __weak NSView *frontedPage;
  NSUInteger frontGeneration{};
};

struct UniVersePageReports {
  NSString *theme;
  NSString *themeSource;
  NSInteger blockedCount{};
  NSString *lastBlocked;
  UniVerseNowPlaying *nowPlaying;
  NSMutableDictionary<NSString *, NSString *> *notificationFrames;
  NSMutableDictionary<NSString *, NSDictionary *> *displayRequests;
  double pinchScale{};
  BOOL capturing{};
  BOOL crashed{};
  BOOL seenByUser{YES};
  BOOL inPictureInPicture{};
  BOOL autoPictureInPictureActive{};
  BOOL keptByWindowServer{};
  BOOL playedForAutoPictureInPicture{};
};

struct UniVerseCommits {
  __weak UniVerseCoreTab *tab;
  NSString *url;
  double at{};
  int httpStatus{};
  int documents{};
};

struct UniVersePageFocusState {
  UniVersePageFocus page{UniVersePageFocus::Unknown};
  __weak NSView *devTools;
  BOOL onActivate{};
  BOOL keepsOutgoing{};
  CFTimeInterval activatedAt{};
  __weak NSWindow *activatedIn;
};

@interface UniVerseWebView () <UniVerseCoreTabDelegate> {
  __weak id<UniVerseWebViewDelegate> _delegate;
  UniVerseTabLifecycle _life;
  UniVerseRequests _requests;
  UniVerseSentReports _sent;
  UniVerseLeave _leave;
  UniVerseFrameHold _frameHold;
  UniVerseStandIn _standIn;
  UniVerseLittlePage _littlePage;
  UniVerseReveal _reveal;
  UniVersePageFocusState _focus;
  UniVersePageReports _reports;
  UniVerseCommits _commits;
  NSString *_profile;
  NSString *_initialURL;
  NSString *_adoptId;
  NSString *_transferKey;
  BOOL _standalone;
  BOOL _temporary;
  NSString *_temporarySource;
  NSString *_extensionHost;
  NSColor *_pageBackgroundColor;
  NSColor *_contentsBackgroundColor;
  NSString *_pageColor;
  NSString *_shownURL;
  BOOL _visible;
  BOOL _warm;
  BOOL _neighbour;
  BOOL _autoPictureInPicture;
  BOOL _frozen;
  UniVerseCoreTab *_tab;
  BOOL _muted;
  NSInteger _tabIndex;
  BOOL _pinned;
  NSView *_devtoolsView;
  CFTimeInterval _linkDropAt;
  NSMutableArray<NSDictionary<NSString *, id> *> *_newTabLinks;
  id _sightObserver;
}
- (UniVerseWindowController *)controller;
- (void)emit:(NSString *)name payload:(NSDictionary *)payload;
@end

typedef NS_ENUM(NSInteger, UniVerseTransfer) {
  UniVerseTransferNone,
  UniVerseTransferTaken,
  UniVerseTransferHeld,
};

@interface UniVerseWebView (TransferInternal)
+ (BOOL)keepTransfersOfWindow:(NSWindow *)window;
+ (void)retryPagesInWindow:(UniVerseWindowController *)controller;
- (void)waitForWindow;
- (BOOL)takeLinkTab:(NSString *)adoptId;
- (void)ensureTab;
- (BOOL)cloneTab:(NSString *)sourceKey profile:(UniVerseCoreProfile *)profile;
- (BOOL)canTake:(UniVerseCoreTab *)tab;
- (UniVerseTransfer)takeTransferredTab;
- (void)bindRestoreKey;
@end

@interface UniVerseWebView (TabInternal)
- (UniVerseCoreAdoption)adoptIntoWindow;
- (UniVerseCoreAdoption)windowTakes:(UniVerseCoreTab *)tab;
- (void)adoptMovedPage;
- (BOOL)holdTransferOf:(UniVerseCoreTab *)tab;
- (void)attach:(UniVerseCoreTab *)tab;
- (void)detach;
- (void)stashPageReports;
- (void)takePageReports;
- (void)placeTab;
- (void)openedTab:(UniVerseCoreTab *)tab adoptId:(NSString *)adoptId disposition:(NSString *)disposition;
- (void)openedLinkTab:(UniVerseCoreTab *)tab adoptId:(NSString *)adoptId disposition:(NSString *)disposition;
- (void)announceOpenedTab:(UniVerseCoreTab *)tab
                  adoptId:(NSString *)adoptId
              disposition:(NSString *)disposition
                     link:(BOOL)link
                    tries:(int)tries;
- (void)noteNewTabLink:(nullable NSString *)url;
- (void)tabRemovedFromWindow:(UniVerseCoreWindow *)window;
- (void)tabActivatedByChrome:(BOOL)chromes;
- (void)devToolsChanged:(NSView *)devToolsView;
- (void)dropDevTools;
@end

@interface UniVerseWebView (PaintingInternal)
+ (void)sleepNeighbourPagesIn:(NSWindow *)window after:(CFTimeInterval)delay;
+ (void)repaintWarmPagesIn:(NSWindow *)window;
+ (void)noteShown:(UniVerseCoreTab *)tab;
+ (void)drainPainting;
- (void)layoutPage;
- (BOOL)paints;
- (BOOL)neighbourPageAsleep;
- (void)holdLittlePage;
- (void)revealLittlePage:(BOOL)animated;
- (void)applyPainting;
- (void)markTemporary;
- (BOOL)seenByUser;
- (void)userSightChanged;
- (void)schedulePainting;
- (void)leaveScreen;
- (void)beginFrameHoldIfCold;
- (void)exposePage;
- (BOOL)releasePageForOffscreen;
- (void)finishFrameHold;
- (void)stopHolding;
- (void)takeFocusFromLingeringPane;
@end

@interface UniVerseWebView (StandInInternal)
- (void)lendPageToSuccessor;
- (void)reclaimLentPage;
- (BOOL)closesLentTab:(UniVerseCoreTab *)tab;
- (void)dropStandIn;
- (void)finishStandIn;
@end

@interface UniVerseWebView (FocusInternal)
+ (UniVerseWebView *)holding:(id)responder;
- (void)storePageFocus;
- (void)storePageFocusFrom:(NSResponder *)responder;
- (void)requestFocusRestore;
- (void)requestFocusRestoreIn:(NSWindow *)window;
- (void)restoreFocusIfDue;
- (void)focusAfterLoad;
@end

@interface UniVerseWebView (RevealsInternal)
+ (void)dropRevealsInWindow:(NSWindow *)window except:(UniVerseWebView *)keep;
- (BOOL)onlyShownInWindow;
- (void)frontPage:(NSView *)page profile:(UniVerseCoreProfile *)profile;
- (void)dropFront;
- (void)revealAhead;
- (void)endReveal;
- (void)dropReveal;
- (void)settleRevealsInWindow;
@end

@interface UniVerseWebView (PageMessagesInternal)
- (void)noteScriptFrame:(NSString *)frameId main:(BOOL)main;
- (void)forgetScriptFrame:(NSString *)frameId;
- (void)pushSelectionPopover;
- (void)callFrame:(NSString *)frameId kind:(NSString *)kind json:(NSString *)json;
- (void)resetPageMedia;
@end

@interface UniVerseWebView (PeekInternal)
- (void)pushPeekModifier;
- (BOOL)peeksLinksToOtherSites;
- (void)fallBackFromPeek:(NSDictionary *)dict url:(NSString *)url frame:(NSString *)frameId reason:(NSString *)reason test:(BOOL)test;
- (void)peekLink:(NSDictionary *)dict frame:(NSString *)frameId main:(BOOL)main;
@end

@interface UniVerseWebView (PictureInPictureInternal)
- (void)traceManualPictureInPicture:(NSString *)what;
- (void)traceAutoPictureInPicture:(NSString *)what;
- (void)awaitPictureInPicture:(int)tries completion:(void (^)(BOOL))completion;
- (void)updateAutoPictureInPicture;
- (BOOL)leftAppInPictureInPicture;
- (BOOL)playsForAutoPictureInPicture;
- (void)autoPictureInPictureInputsChanged;
- (void)noteStayedOnAppSwitch;
+ (BOOL)playsForAutoPictureInPictureInWindow:(NSWindow *)window;
@end

@interface UniVerseWebView (NavigationInternal)
- (void)emitNavigation;
- (void)queueNavigation;
- (NSString *)committedURL;
- (void)followCommitsOfTab;
- (void)resetBlocked:(BOOL)report;
- (void)sendProgress;
- (void)loadNow:(NSString *)url userInitiated:(BOOL)userInitiated;
- (BOOL)skipsNavigationDownload:(NSString *)url userInitiated:(BOOL)userInitiated;
@end

@interface UniVerseWebView (PageCommandsInternal)
- (void)emitMedia;
- (void)emitZoom;
- (void)runChromeCommand:(int)command;
- (void)thawHiddenPage;
- (BOOL)awaitsFirstDocument;
@end

@interface UniVerseWebView (InputMonitorsInternal)
+ (BOOL)prewarmForMouseEvent:(NSEvent *)event;
- (BOOL)canWakeFrames;
- (void)commandWheelFromPage:(NSDictionary *)reply;
@end

namespace universe_web_view {

constexpr CFTimeInterval kNeighbourPagesAwakeSeconds = 10;

bool TraceVisibility();
NSHashTable<UniVerseWebView *> *LiveViews();
bool SamePage(NSString *a, NSString *b);
NSString *OriginOf(NSString *url);
NSString *VerifiedOrigin(NSString *origin);
void NoteEvent(int browserId, NSString *name, NSDictionary *payload);
void AcceptDrops(NSView *root, BOOL accept);
NSView *PaneUnder(NSView *view, NSView *ancestor);
NSView *SharedAncestor(NSView *a, NSView *b);

template <typename T>
T *Field(NSDictionary *d, NSString *key) {
  id value = d[key];
  return [value isKindOfClass:[T class]] ? value : nil;
}

NSString *Text(NSDictionary *d, NSString *key, NSUInteger max);
bool Flag(NSDictionary *d, NSString *key);
bool Finite(NSDictionary *d, NSString *key, double *out);

void AnswerHello(UniVerseCoreTab *tab, NSString *profile, NSString *frameId, BOOL main, NSString *verifiedOrigin);
NSMutableOrderedSet<NSString *> *ScriptFramesOf(UniVerseCoreTab *tab);

extern NSString *gPeekModifier;
void InstallPeekMonitor();
BOOL PeekTracing();
void PeekTrace(NSDictionary *entry);
NSString *SplitLinkModifier();
NSString *PeekConfigJSON(UniVerseWebView *view);
NSDictionary *_Nullable RecentClickPoint(UniVerseWebView *view);
BOOL MayHoldUserActivation(NSWindow *window);

void InstallControlPressMonitor();
BOOL TracingPictureInPicture();

}
