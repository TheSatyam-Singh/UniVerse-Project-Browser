#import "UniVerseTryCatch.h"

NSString *UniVerseTryCatch(NS_NOESCAPE void (^block)(void)) {
  @try {
    block();
    return nil;
  } @catch (NSException *exception) {
    return exception.reason ?: exception.name;
  }
}
