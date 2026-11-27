// Copyright 2026 UniVerse. Apache-2.0.

#ifndef CHROME_BROWSER_UNIVERSE_AC_EXTERNAL_APPS_H_
#define CHROME_BROWSER_UNIVERSE_AC_EXTERNAL_APPS_H_

#import <Foundation/Foundation.h>

namespace universe {

struct ExternalApp {
  NSString* name;
  NSString* icon;
};

ExternalApp DescribeExternalApp(NSURL* app);

}

#endif
