#import "UniVerseEvents.h"
#import "UniVerseDownloadMover.h"

namespace {

NSMutableDictionary<NSString *, void (^)(NSString *, NSDictionary *)> *Senders() {
  static NSMutableDictionary *senders = [NSMutableDictionary dictionary];
  return senders;
}

NSString *DomainOf(NSString *name) {
  const NSRange dot = [name rangeOfString:@"."];
  return dot.location == NSNotFound ? name : [name substringToIndex:dot.location];
}

}

@implementation UniVerseEvents

+ (void)setSender:(void (^)(NSString *, NSDictionary *))sender forDomain:(NSString *)domain {
  Senders()[domain] = [sender copy];
}

+ (BOOL)listens:(NSString *)domain {
  return Senders()[domain] != nil;
}

+ (void)emit:(NSString *)name data:(NSDictionary *)data {
  if ([name isEqualToString:@"downloads.changed"] && data) data = [UniVerseDownloadMover.shared noteDownloadEvent:data];
  if (void (^sender)(NSString *, NSDictionary *) = Senders()[DomainOf(name)]) sender(name, data ?: @{});
}

@end
