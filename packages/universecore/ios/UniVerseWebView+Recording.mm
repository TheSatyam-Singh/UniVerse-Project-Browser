#import "UniVerseWebViewInternal.h"
#import "UniVersePictureInPictureInternal.h"
#import "UniVerseWindowController.h"

static const NSTimeInterval kRecordingPictureTimeout = 0.5;

@implementation UniVerseWebView (Recording)

- (void)copyRecordingPicture:(void (^)(CGImageRef _Nullable picture))completion {
  if (!self.recordingShowsPage || !self.window || self.isHiddenOrHasHiddenAncestor) return completion(NULL);
  [_tab copyPicture:kRecordingPictureTimeout completion:completion];
}

- (BOOL)recordingShowsPage {
  NSView *page = _tab.view;
  return page && page.superview == self && !page.hidden && page.alphaValue > 0.01;
}

+ (NSArray<NSWindow *> *)recordingPictureInPictureWindowsOfWindow:(NSWindow *)window {
  UniVerseWindowController *owner = [UniVerseWindowController forNSWindow:window];
  if (!owner || owner.coreWindow.window != window) return @[];
  NSMutableArray<NSWindow *> *owned = [NSMutableArray array];
  for (NSWindow *candidate in NSApp.windows) {
    UniVersePiPController *controller = [UniVersePiPController forWindow:candidate];
    UniVerseWebView *view = controller.view;
    UniVerseCoreTab *tab = view ? view->_tab : nil;
    if (controller.window == candidate && tab && !tab.closed && [UniVerseWindowController holding:tab] == owner) [owned addObject:candidate];
  }
  return owned;
}

+ (BOOL)recordingWindowIsPrivate:(NSWindow *)window {
  UniVerseWindowController *owner = [UniVerseWindowController forNSWindow:window];
  UniVerseCoreProfile *profile = owner.coreWindow.activeProfile;
  return !owner || !profile || profile.offTheRecord;
}

+ (CGFloat)recordingCornerRadiusOfWindow:(NSWindow *)window {
  UniVersePiPController *controller = [UniVersePiPController forWindow:window];
  return controller ? controller.cornerRadius : window.contentView.layer.cornerRadius;
}

+ (void)copyRecordingPictureOfWindow:(NSWindow *)window completion:(void (^)(CGImageRef _Nullable picture))completion {
  [UniVerseCoreWindow copyPictureOfChromeWindow:window completion:completion];
}

+ (NSView *)recordingControlsOfWindow:(NSWindow *)window {
  return [UniVersePiPController forWindow:window].overlay;
}

@end
