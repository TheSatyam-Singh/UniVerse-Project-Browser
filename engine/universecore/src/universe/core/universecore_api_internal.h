#ifndef UNIVERSE_CORE_UNIVERSECORE_API_INTERNAL_H_
#define UNIVERSE_CORE_UNIVERSECORE_API_INTERNAL_H_

#import "universe/core/public/UniVerseCore.h"

#include <string>

#include "base/functional/callback_forward.h"

class Profile;

namespace universecore {

extern id<UniVerseCoreEngineDelegate> __strong g_delegate;
extern UniVerseCoreEngine* __strong g_engine;

NSString* NS(const std::string& s);
NSString* NS(const std::u16string& s);

void WhenProfileGone(Profile* profile, base::OnceClosure done);

}

#endif
