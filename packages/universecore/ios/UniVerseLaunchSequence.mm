#import "UniVerseLaunchSequence.h"

@interface UniVerseLaunchWaiter : NSObject
@property(nonatomic) UniVerseLaunchMilestone milestones;
@property(nonatomic, copy) dispatch_block_t block;
@end

@implementation UniVerseLaunchWaiter
@end

@implementation UniVerseLaunchSequence {
  UniVerseLaunchMilestone _reached;
  NSMutableArray<UniVerseLaunchWaiter *> *_waiters;
}

+ (UniVerseLaunchSequence *)shared {
  static UniVerseLaunchSequence *shared = [UniVerseLaunchSequence new];
  return shared;
}

- (instancetype)init {
  if ((self = [super init])) _waiters = [NSMutableArray array];
  return self;
}

- (BOOL)reached:(UniVerseLaunchMilestone)milestones {
  return (_reached & milestones) == milestones;
}

- (void)reach:(UniVerseLaunchMilestone)milestone {
  if (_shutDown) return;
  _reached |= milestone;
  for (;;) {
    NSUInteger ready = [_waiters indexOfObjectPassingTest:^BOOL(UniVerseLaunchWaiter *waiter, NSUInteger, BOOL *) {
      return [self reached:waiter.milestones];
    }];
    if (ready == NSNotFound || _shutDown) return;
    UniVerseLaunchWaiter *waiter = _waiters[ready];
    [_waiters removeObjectAtIndex:ready];
    waiter.block();
  }
}

- (void)appKitFinishedHidden:(BOOL)hidden forDocuments:(BOOL)documents {
  _launchedHidden = hidden;
  _launchedForDocuments = documents;
  [self reach:UniVerseLaunchAppKitDidFinish];
}

- (void)after:(UniVerseLaunchMilestone)milestones do:(dispatch_block_t)block {
  if (_shutDown) return;
  UniVerseLaunchWaiter *waiter = [UniVerseLaunchWaiter new];
  waiter.milestones = milestones;
  waiter.block = block;
  [_waiters addObject:waiter];
  [self reach:0];
}

- (void)engineShutDown {
  _engineRunning = NO;
  _shutDown = YES;
  [_waiters removeAllObjects];
}

@end
