#import <AppKit/AppKit.h>

#define UNIVERSECORE_EXPORT __attribute__((visibility("default")))

NS_ASSUME_NONNULL_BEGIN

@class UniVerseCoreEngine;
@class UniVerseCoreProfile;
@class UniVerseCoreTab;
@class UniVerseCoreWindow;

@protocol UniVerseCoreEngineDelegate <NSObject>
- (void)engineDidStart;
- (void)engineWillShutDown;
- (void)engineQuitCancelled;
- (nullable UniVerseCoreWindow*)engineWindowForNewBrowserOfProfile:(UniVerseCoreProfile*)profile
                                                        type:(NSString*)type;
- (void)engine:(UniVerseCoreEngine*)engine
    permissionRequest:(NSDictionary<NSString*, id>*)request
                  tab:(UniVerseCoreTab*)tab;
- (void)engine:(UniVerseCoreEngine*)engine permissionRequestDismissed:(NSString*)requestId;
- (void)engine:(UniVerseCoreEngine*)engine
    extensionSidePanel:(NSDictionary<NSString*, id>*)panel
                   tab:(UniVerseCoreTab*)tab;
- (BOOL)engine:(UniVerseCoreEngine*)engine
    extensionActionPopup:(NSDictionary<NSString*, id>*)popup
                     tab:(UniVerseCoreTab*)tab;
- (BOOL)engine:(UniVerseCoreEngine*)engine
    extensionActionShortcut:(NSDictionary<NSString*, id>*)shortcut
                        tab:(UniVerseCoreTab*)tab;
- (BOOL)engineIsReservedKeyEvent:(NSEvent*)event;
- (BOOL)engineIsReservedKey:(NSString*)key
               unshiftedKey:(NSString*)unshiftedKey
                  modifiers:(NSEventModifierFlags)modifiers;
- (void)engine:(UniVerseCoreEngine*)engine
    extensionInstallPrompt:(NSDictionary<NSString*, id>*)prompt
                   profile:(UniVerseCoreProfile*)profile
                       tab:(nullable UniVerseCoreTab*)tab;
- (void)engine:(UniVerseCoreEngine*)engine
    extensionInstallFailed:(NSString*)message
                       tab:(nullable UniVerseCoreTab*)tab;
- (void)engine:(UniVerseCoreEngine*)engine
    deviceChooser:(NSDictionary<NSString*, id>*)chooser
              tab:(UniVerseCoreTab*)tab;
- (void)engine:(UniVerseCoreEngine*)engine
    castDialog:(NSDictionary<NSString*, id>*)dialog
           tab:(UniVerseCoreTab*)tab;
- (void)engine:(UniVerseCoreEngine*)engine
    castRoutes:(NSArray<NSDictionary<NSString*, NSString*>*>*)routes
       profile:(UniVerseCoreProfile*)profile;
@end

UNIVERSECORE_EXPORT
@interface UniVerseCoreEngine : NSObject
+ (int)runWithArgc:(int)argc
              argv:(const char* _Nonnull* _Nonnull)argv
          delegate:(id<UniVerseCoreEngineDelegate>)delegate;
@property(class, readonly, nullable) UniVerseCoreEngine* sharedEngine;

@property(readonly) UniVerseCoreProfile* defaultProfile;
- (void)loadProfile:(NSString*)directoryName
         completion:(void (^)(UniVerseCoreProfile* _Nullable profile))completion;
- (void)quit;
@property(nonatomic, copy, nullable) NSString* pageScript;
+ (void)resolvePermission:(NSString*)requestId
                   result:(NSString*)result
                 remember:(BOOL)remember;
+ (void)resolveExtensionInstallPrompt:(NSString*)requestId accepted:(BOOL)accepted;
+ (void)startCasting:(int)dialogId sink:(NSString*)sinkId mode:(int)castMode;
+ (void)stopCasting:(int)dialogId route:(NSString*)routeId;
+ (void)closeCastDialog:(int)dialogId;
+ (void)terminateCastRoute:(NSString*)routeId;
+ (void)setAutoPictureInPicture:(BOOL)enabled;
+ (void)setVideoUpscaling:(BOOL)enabled;
+ (void)setVideoUpscalingTestConditions:(NSDictionary<NSString*, NSNumber*>*)conditions;
@property(class, readonly) NSDictionary<NSString*, id>* videoUpscalingState;
+ (void)reservedShortcutsChanged;
+ (void)selectDevice:(int)chooserId index:(int)index;
+ (void)cancelDeviceChooser:(int)chooserId;
+ (void)refreshDeviceChooser:(int)chooserId;
+ (void)openDeviceChooserSettings:(int)chooserId;
- (void)deleteProfile:(UniVerseCoreProfile*)profile
           completion:(nullable void (^)(BOOL deleted))completion;
- (void)releaseProfile:(UniVerseCoreProfile*)profile;
+ (void)resolveExternalApp:(NSString*)requestId open:(BOOL)open remember:(BOOL)remember;
@property(class, readonly) NSArray<NSDictionary*>* testExternalLaunches;
@property(class, readonly) NSArray<NSDictionary*>* testChooserEvents;
+ (void)allowDesktopCapture:(NSString*)sourceId
                        tab:(UniVerseCoreTab*)tab
                      frame:(nullable NSString*)frameId
                     origin:(nullable NSString*)origin
                      audio:(nullable NSString*)audio;
@property(class, readonly) NSDictionary<NSString*, NSNumber*>* desktopCaptureAudio;
@property(class) BOOL pagesPickDisplayMedia;
- (void)offTheRecordProfileFor:(UniVerseCoreProfile*)profile
                    completion:(void (^)(UniVerseCoreProfile* _Nullable offTheRecord,
                                         NSString* _Nullable error))completion;
@property(readonly) NSString* chromiumVersion;
@property(readonly) NSString* keepAliveState;
@end

@interface UniVerseCoreEngine (Tracing)
+ (void)beginTracing:(void (^)(BOOL started))completion;
+ (void)endTracing:(BOOL)keep completion:(void (^)(NSString* _Nullable path))completion;
@property(class, readonly) BOOL isTracing;
@end

UNIVERSECORE_EXPORT
@interface UniVerseCoreProfile : NSObject
@property(readonly) NSString* name;
@property(readonly) NSString* path;
@property(readonly) BOOL offTheRecord;
@property(readonly) BOOL destroyed;
- (nullable NSString*)loadComponentExtension:(NSString*)path;
- (void)unloadComponentExtension:(NSString*)extensionId;
- (void)warmSpareRenderer;
- (void)holdNavigationsUntilRulesetsOf:(NSString*)extensionId;
- (void)releaseNavigationHold:(NSString*)reason;
- (void)releaseNavigationHoldReady;
- (void)watchCastRoutes;
@property BOOL passwordsOffered;
@property BOOL addressesAutofilled;
@property BOOL cardsAutofilled;
- (void)clearBrowsingData:(NSArray<NSString*>*)types
                    since:(nullable NSDate*)since
               completion:(nullable void (^)(void))completion;
@end

@interface UniVerseCoreProfile (Icons)
- (void)fetchIcon:(NSString*)url
         maxBytes:(NSUInteger)maxBytes
       completion:(void (^)(NSData* _Nullable body))completion;
@end

typedef NS_ENUM(NSInteger, UniVerseCoreAdoption) {
  UniVerseCoreAdoptionRefused,
  UniVerseCoreAdoptionAdopted,
  UniVerseCoreAdoptionBusy,
};

@protocol UniVerseCoreWindowDelegate <NSObject>
@optional
- (void)window:(UniVerseCoreWindow*)window
    didInsertTab:(UniVerseCoreTab*)tab
          opener:(nullable UniVerseCoreTab*)opener
     disposition:(NSString*)disposition;
- (void)window:(UniVerseCoreWindow*)window didRemoveTab:(UniVerseCoreTab*)tab;
- (void)window:(UniVerseCoreWindow*)window didActivateTab:(UniVerseCoreTab*)tab;
- (void)window:(UniVerseCoreWindow*)window
    devToolsDidChangeForTab:(UniVerseCoreTab*)tab
                       view:(nullable NSView*)devToolsView;
- (void)window:(UniVerseCoreWindow*)window
                    tab:(UniVerseCoreTab*)tab
    didChangeFullscreen:(BOOL)fullscreen;
- (void)window:(UniVerseCoreWindow*)window
    passwordPrompt:(NSDictionary<NSString*, id>*)prompt
            forTab:(UniVerseCoreTab*)tab;
- (void)window:(UniVerseCoreWindow*)window
    autofillPrompt:(NSDictionary<NSString*, id>*)prompt
            forTab:(UniVerseCoreTab*)tab;
- (void)window:(UniVerseCoreWindow*)window showRequestedActive:(BOOL)active;
- (BOOL)windowShouldClose:(UniVerseCoreWindow*)window;
- (void)windowDidCancelClose:(UniVerseCoreWindow*)window;
- (void)windowCanTakeTabs:(UniVerseCoreWindow*)window;
- (void)window:(UniVerseCoreWindow*)window
    confirmCloseWithDownloads:(int)count
                   completion:(void (^)(BOOL closeAnyway))completion;
- (BOOL)window:(UniVerseCoreWindow*)window preHandleKeyEvent:(NSEvent*)event;
- (BOOL)window:(UniVerseCoreWindow*)window handleKeyEvent:(NSEvent*)event;
@end

UNIVERSECORE_EXPORT
@interface UniVerseCoreWindow : NSObject
+ (nullable NSView*)embeddedRootOfWindow:(NSWindow*)window;
+ (Class)contentViewClass;
+ (BOOL)isChromeFramelessWindow:(NSWindow*)window;
- (instancetype)initWithContentRect:(NSRect)rect;
@property(readonly) NSWindow* window;
@property(readonly) NSView* hostView;
@property(weak, nullable) id<UniVerseCoreWindowDelegate> delegate;

- (UniVerseCoreTab*)openTab:(NSString*)url
              profile:(UniVerseCoreProfile*)profile
           foreground:(BOOL)foreground;
- (nullable UniVerseCoreTab*)openExtensionView:(NSString*)url
                                 profile:(UniVerseCoreProfile*)profile
                                    kind:(NSString*)kind;
@property(nonatomic, nullable) UniVerseCoreProfile* activeProfile;
- (void)activateTab:(UniVerseCoreTab*)tab;
- (NSArray<UniVerseCoreTab*>*)tabsForProfile:(UniVerseCoreProfile*)profile;
- (int)chromeWindowIdForProfile:(UniVerseCoreProfile*)profile;
- (BOOL)executeChromeCommand:(int)commandId profile:(UniVerseCoreProfile*)profile;
- (void)showInactive;
@property(nonatomic) BOOL actedFullScreen;
- (void)close;

- (void)prepareProfile:(UniVerseCoreProfile*)profile;
- (UniVerseCoreAdoption)adoptTab:(UniVerseCoreTab*)tab;
- (UniVerseCoreAdoption)canAdoptTab:(UniVerseCoreTab*)tab;
- (nullable UniVerseCoreTab*)restoreTab:(nullable NSString*)state
                          profile:(UniVerseCoreProfile*)profile
                       foreground:(BOOL)foreground;
- (nullable UniVerseCoreTab*)duplicateTab:(UniVerseCoreTab*)source
                            profile:(UniVerseCoreProfile*)profile
                         foreground:(BOOL)foreground;
- (void)placeTab:(UniVerseCoreTab*)tab index:(int)index pinned:(BOOL)pinned;
@property(nonatomic) BOOL internal;
@property(nonatomic) BOOL automation;
@end

@interface UniVerseCoreWindow (Picture)
+ (void)copyPictureOfChromeWindow:(NSWindow*)window
                       completion:(void (^)(CGImageRef _Nullable picture))completion;
@end

@protocol UniVerseCoreTabDelegate <NSObject>
@optional
- (void)tabDidChangeTitle:(UniVerseCoreTab*)tab;
- (void)tabDidChangeURL:(UniVerseCoreTab*)tab;
- (void)tabDidChangeLoading:(UniVerseCoreTab*)tab;
- (void)tabDidChangeProgress:(UniVerseCoreTab*)tab;
- (void)tabDidChangeFavicon:(UniVerseCoreTab*)tab;
- (void)tabDidChangeNavigationState:(UniVerseCoreTab*)tab;
- (void)tab:(UniVerseCoreTab*)tab didFindMatches:(int)count active:(int)active final:(BOOL)final;
- (void)tab:(UniVerseCoreTab*)tab
    didReceivePageMessage:(NSString*)kind
                     json:(NSString*)json
                    frame:(NSString*)frameId
                     main:(BOOL)main
                   origin:(NSString*)origin;
- (void)tabWillClose:(UniVerseCoreTab*)tab;
- (void)tab:(UniVerseCoreTab*)tab rendererGone:(NSString*)status code:(int)code;
- (void)tab:(UniVerseCoreTab*)tab didFailLoad:(NSString*)url code:(int)code description:(NSString*)text;
- (void)tab:(UniVerseCoreTab*)tab didChangeStatusText:(NSString*)text;
- (void)tab:(UniVerseCoreTab*)tab didRequestAppURL:(NSString*)url userGesture:(BOOL)userGesture;
- (void)tabDidChangeThemeColor:(UniVerseCoreTab*)tab;
- (void)tabDidCommitDocument:(UniVerseCoreTab*)tab;
- (void)tabDidGainFocus:(UniVerseCoreTab*)tab;
- (void)tabDidChangeAudio:(UniVerseCoreTab*)tab;
- (void)tabDidChangeSecurity:(UniVerseCoreTab*)tab;
- (void)tabDidChangeZoom:(UniVerseCoreTab*)tab;
- (void)tab:(UniVerseCoreTab*)tab didBlockPopup:(NSDictionary<NSString*, NSString*>*)popup;
- (void)tab:(UniVerseCoreTab*)tab preferredSizeDidChange:(NSSize)size;
- (void)tab:(UniVerseCoreTab*)tab externalAppRequest:(NSDictionary<NSString*, id>*)request;
- (void)tab:(UniVerseCoreTab*)tab requestsActivation:(NSString*)reason;
- (void)tab:(UniVerseCoreTab*)tab didChangePictureInPicture:(NSDictionary<NSString*, id>*)state;
- (void)tab:(UniVerseCoreTab*)tab didShowAutofillSuggestions:(NSArray<NSDictionary<NSString*, NSString*>*>*)items;
- (void)tab:(UniVerseCoreTab*)tab didBlockRequests:(int)count lastURL:(NSString*)url;
- (NSArray<NSDictionary<NSString*, NSString*>*>*)tab:(UniVerseCoreTab*)tab
                         contextMenuItemsForSelection:(NSString*)text;
- (void)tab:(UniVerseCoreTab*)tab
    contextMenuCommand:(NSString*)itemId
                  text:(NSString*)selection
             modifiers:(NSDictionary<NSString*, NSNumber*>*)modifiers;
- (void)tab:(UniVerseCoreTab*)tab shareFromContextMenu:(NSDictionary<NSString*, id>*)share;
- (void)tab:(UniVerseCoreTab*)tab didShowContextMenu:(NSArray<NSDictionary*>*)items;
- (nullable NSDictionary<NSString*, id>*)tab:(UniVerseCoreTab*)tab
                              runContextMenu:(NSDictionary<NSString*, id>*)menu;
- (void)tab:(UniVerseCoreTab*)tab navigationBecameDownload:(NSString*)url;
- (void)tabDidChangeDiscarded:(UniVerseCoreTab*)tab;
- (void)tabBecameUnresponsive:(UniVerseCoreTab*)tab;
- (void)tabBecameResponsive:(UniVerseCoreTab*)tab;
- (void)tab:(UniVerseCoreTab*)tab didChangeMediaAccess:(NSDictionary<NSString*, NSNumber*>*)access;
@end

UNIVERSECORE_EXPORT
@interface UniVerseCoreTab : NSObject
@property(readonly) NSView* view;
@property(readonly, weak) UniVerseCoreProfile* profile;
@property(readonly) int tabId;
@property(readonly) NSString* url;
@property(readonly) NSString* title;
@property(readonly) BOOL loading;
@property(readonly) double progress;
@property(readonly, nullable) NSImage* favicon;
@property(readonly) BOOL canGoBack;
@property(readonly) BOOL canGoForward;
@property(readonly) BOOL closed;
@property(weak, nullable) id<UniVerseCoreTabDelegate> delegate;

- (void)focus;
- (void)find:(NSString*)text forward:(BOOL)forward;
- (void)stopFinding;
- (void)close;
@property(readonly, nullable) NSDictionary<NSString*, id>* passwordPrompt;
- (void)resolvePasswordPrompt:(NSString*)action
                     username:(nullable NSString*)username
                     password:(nullable NSString*)password;
@property(readonly, nullable) NSDictionary<NSString*, id>* autofillPrompt;
- (void)resolveAutofillPrompt:(NSInteger)promptId action:(NSString*)action;

@property(readonly, nullable) NSString* faviconURL;
@property(readonly, nullable) NSString* themeColor;
@property(readonly) BOOL audible;
@property(nonatomic) BOOL muted;
@property(readonly) int browserId;
@property(readonly, nullable) NSString* committedOrigin;
+ (nullable NSString*)originForURL:(NSString*)url;
@property(readonly) BOOL initialDocumentAccessed;
@property(readonly) BOOL committedInitial;
- (nullable id)suppressInput;
- (void)closeNow;
@property(nonatomic) BOOL temporary;
- (void)setTemporarySource:(nullable UniVerseCoreTab*)source;
- (void)deliverHeldPageMessages;
@property(readonly) NSDictionary<NSString*, id>* securityInfo;
- (BOOL)discard;
@property(readonly) BOOL discarded;
@property(readonly, nullable) NSString* discardReason;
@property(nonatomic) BOOL frozen;
- (void)resolveUnresponsive:(BOOL)terminate;
- (BOOL)showAutofillSuggestions:(BOOL)passwords;
@property(readonly, nullable) NSDictionary<NSString*, NSNumber*>* popupFeatures;
@property(readonly) NSSize preferredSize;
@end

@interface UniVerseCoreTab (Navigation)
- (void)goBack;
- (void)goForward;
- (void)reload;
- (void)stop;
- (void)loadURL:(NSString*)url userInitiated:(BOOL)userInitiated;
- (void)goToOffset:(int)offset;
- (void)reloadIgnoringCache;
- (void)loadIfNeeded;
@property(readonly) NSArray<NSDictionary<NSString*, id>*>* navigationEntries;
@property(readonly) int committedHTTPStatus;
@property(readonly) int committedDocumentCount;
@end

@interface UniVerseCoreTab (Page)
- (void)executeJavaScript:(NSString*)code frame:(nullable NSString*)frameId;
- (void)evaluate:(NSString*)code completion:(void (^)(NSString* _Nullable json))completion;
- (BOOL)hasLiveFrame:(NSString*)frameId;
- (void)callPage:(NSString*)kind json:(NSString*)json;
- (void)callFrame:(NSString*)frameId kind:(NSString*)kind json:(NSString*)json;
- (void)grantUserActivationToFrame:(NSString*)frameId;
@property(nonatomic, nullable) NSColor* pageBackgroundColor;
@property(nonatomic, copy, nullable) NSString* pageColor;
@property(nonatomic, nullable) NSColor* contentsBackgroundColor;
@property(nonatomic) double zoomFactor;
- (void)zoomStep:(int)direction;
@property(readonly) double pinchScale;
@end

@interface UniVerseCoreTab (Commands)
- (BOOL)executeChromeCommand:(int)command;
- (void)openBlockedPopup:(NSString*)popupId always:(BOOL)always;
- (void)showDevTools;
- (void)closeDevTools;
@property(readonly, nullable) NSView* devToolsView;
- (void)devToolsLayoutForSize:(NSSize)size
                     devTools:(NSRect*)devToolsFrame
                         page:(NSRect*)pageFrame;
- (void)devToolsCall:(NSString*)method
              params:(nullable NSDictionary*)params
             timeout:(NSTimeInterval)timeout
          completion:(void (^)(NSDictionary* _Nullable result,
                               NSString* _Nullable error))completion;
@end

@interface UniVerseCoreTab (Media)
@property(readonly, nullable) NSString* mediaCaptureSourceId;
- (void)copyPicture:(NSTimeInterval)timeout completion:(void (^)(CGImageRef _Nullable picture))completion;
- (BOOL)stopCapture;
- (void)noteShownByHost:(BOOL)shown;
- (void)noteInShownSlot;
- (void)exitFullscreen;
- (void)exitExclusiveAccess;
- (void)tracePictureInPicture:(NSString*)line withInputs:(BOOL)withInputs;
- (void)exitPictureInPicture;
- (void)enterPictureInPictureForClickAt:(NSTimeInterval)clickTime
                             completion:(void (^)(NSString* route, BOOL opened))completion;
- (BOOL)shareThisTabInsteadFor:(UniVerseCoreTab*)capturer;
- (BOOL)showCastDialog;
- (BOOL)devShowBluetoothChooser:(BOOL)unauthorized;
@end

@interface UniVerseCoreTab (Extensions)
- (NSString*)executeExtensionAction:(NSString*)extensionId;
- (NSDictionary<NSString*, NSDictionary*>*)actionStatesForExtensions:(NSArray<NSString*>*)extensionIds;
- (nullable NSString*)sidePanelURLForExtension:(NSString*)extensionId;
@end

typedef NS_ENUM(NSInteger, UniVerseCorePageScrollAck) {
  UniVerseCorePageScrollAckBegin,
  UniVerseCorePageScrollAckUpdate,
};

@protocol UniVerseCorePageScrollObserver <NSObject>
- (void)pageView:(NSView*)view
     ackedScroll:(UniVerseCorePageScrollAck)ack
        consumed:(BOOL)consumed;
- (void)pageView:(NSView*)view overscrolledAllowingHorizontal:(BOOL)allowed;
@end

UNIVERSECORE_EXPORT
@interface UniVerseCorePageView : NSObject
+ (BOOL)isPageView:(NSView*)view;
+ (void)setScrollObserver:(nullable id<UniVerseCorePageScrollObserver>)observer;
+ (BOOL)takeSwipes:(NSView*)view;
+ (BOOL)takesSwipes:(NSView*)view;
+ (BOOL)isEditingText:(NSView*)view;
@end

NS_ASSUME_NONNULL_END
