#ifndef UNIVERSE_CORE_UNIVERSECORE_INTERNAL_H_
#define UNIVERSE_CORE_UNIVERSECORE_INTERNAL_H_

#import "universe/core/public/UniVerseCore.h"

class Profile;

namespace content {
class WebContents;
}

namespace universecore {
class WindowHost;

void NoteProfileDying(Profile* profile);
bool IsProfileDying(const Profile* profile);
void NoteProfileDeleting(Profile* profile);
bool IsProfileDeleting(const Profile* profile);
}

@interface UniVerseCoreProfile ()
+ (UniVerseCoreProfile*)wrapperFor:(Profile*)profile;
@property(readonly) Profile* chromeProfile;
@end

@interface UniVerseCoreTab ()
- (instancetype)initWithContents:(content::WebContents*)contents;
@property(readonly) content::WebContents* contents;
- (void)contentsDestroyed;
- (void)notify:(SEL)selector;
@end

@interface UniVerseCoreWindow ()
@property(readonly) universecore::WindowHost* host;
@end

#endif
