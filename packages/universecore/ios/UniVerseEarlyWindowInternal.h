#import "UniVerseEarlyWindow.h"
#import "UniVerseInternal.h"
#import "UniVerseSavedSession.h"

#include <os/lock.h>

@interface UniVerseEarlyShown : NSObject
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, copy) NSString *appWindow;
@property(nonatomic, copy) NSString *profile;
@property(nonatomic, strong) NSView *cover;
@property(nonatomic, strong) NSView *picture;
@property(nonatomic, strong) NSView *backdrop;
@property(nonatomic, weak) NSView *root;
@property(nonatomic, strong) NSColor *rootFill;
@property(nonatomic) BOOL rootFillCleared;
@property(nonatomic, strong) UniVerseCoreTab *tab;
@property(nonatomic, copy) NSString *key;
@property(nonatomic, copy) NSString *expectedURL;
@property(nonatomic) NSRect pageRect;
@property(nonatomic) BOOL claimed;
@property(nonatomic) BOOL expired;
@property(nonatomic) BOOL shielded;
@property(nonatomic, strong) id inputBlock;
@property(nonatomic, strong) id contentObserver;
@property(nonatomic, strong) id closeObserver;
@end

@interface UniVerseEarlyVeil : NSObject
@property(nonatomic, strong) NSView *view;
@property(nonatomic, strong) id inputBlock;
@property(nonatomic) BOOL restoreFocus;
@property(nonatomic, copy) NSString *lastShown;
@property(nonatomic) CFTimeInterval changedAt;
@property(nonatomic) NSUInteger armedGeneration;
@property(nonatomic, copy) NSString *armedShown;
@end

@interface UniVersePageEmits : NSObject
@property(nonatomic) NSUInteger generation;
@property(nonatomic, strong) NSMutableOrderedSet<NSString *> *current;
@property(nonatomic, strong) NSMutableOrderedSet<NSString *> *older;
@property(nonatomic) BOOL forgot;
@property(nonatomic) CFTimeInterval firstEmitAt;
@end

namespace universe_early_window {

extern NSString *gLayoutPath;
extern NSString *gDirectory;
extern BOOL gRecordQueued;
extern NSData *gScheduled;
extern NSMutableDictionary<NSString *, NSDictionary *> *gLayouts;
extern os_unfair_lock gPrefetchLock;
extern CGImageRef gPrefetched;
extern NSString *gPrefetchedWindow;
extern dispatch_group_t gPrefetch;
extern NSString *gLaunchURL;
NSHashTable<UniVerseCoreTab *> *Watched();
dispatch_queue_t Writer();
NSMutableArray<UniVerseEarlyShown *> *Shown();
UniVerseEarlyShown *ShownForWindow(NSWindow *window);
NSString *StateOf(UniVerseSavedSession *session, NSString *windowId);
NSString *ContentOf(UniVerseSavedSession *session, NSString *windowId);
bool ReadInsets(id value, CGFloat out[4]);
bool Fits(const CGFloat insets[4], NSView *host);
NSRect RectFromInsets(const CGFloat insets[4], NSView *host);
NSString *PicturePath(NSString *windowId);
BOOL CapturePicture(UniVerseWindowController *controller, NSString *windowId, NSMutableDictionary *layout);
void DropPictureFile(NSString *windowId);
void LoadLayouts();
void Record(BOOL wait);
BOOL ShowsLaunchOrigin(UniVerseCoreTab *tab, NSString *launchURL);
BOOL ReleaseFocusFrom(NSView *page);
void CarryShield(UniVerseCoreTab *tab, id inputBlock, NSString *shownAtPlacement);
void DropCover(UniVerseEarlyShown *s);
void ClearRootFill(UniVerseEarlyShown *s, NSView *root);
void DropPictures(UniVerseEarlyShown *s);
void HandOffPictures(UniVerseEarlyShown *s);
void Forget(UniVerseEarlyShown *s);
void Abandon(UniVerseEarlyShown *s);
NSView *Cover(NSView *host, NSDictionary *layout, NSRect *pageRect);
void Shield(UniVerseEarlyShown *s);
void ApplyLights(NSWindow *window, NSDictionary *layout);
CGImageRef DecodeOutsideHeap(CGImageRef encoded);
CGImageRef TakePrefetched(NSString *windowId);

}
