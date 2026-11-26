#ifndef UNIVERSE_CORE_AC_PERMISSIONS_H_
#define UNIVERSE_CORE_AC_PERMISSIONS_H_

#import <Foundation/Foundation.h>

#include <string>

namespace content {
class WebContents;
}

namespace universecore {

void InstallPermissionPrompts();

void ResolvePermission(const std::string& request_id,
                       const std::string& result,
                       bool remember);

void HostPermissionRequest(content::WebContents* contents, NSDictionary* request);
void HostPermissionRequestDismissed(NSString* request_id);

}

#endif
