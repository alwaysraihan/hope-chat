#import <AudioToolbox/AudioToolbox.h>

#import <React/RCTBridgeModule.h>

@interface HopeChatCallRingtone : NSObject <RCTBridgeModule>
@end

@implementation HopeChatCallRingtone

RCT_EXPORT_MODULE(HopeChatCallRingtone);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

static NSTimer *hopeChatRingTimer = nil;
static NSTimer *hopeChatOutgoingRingbackTimer = nil;

RCT_EXPORT_METHOD(startIncomingRingtone)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [hopeChatOutgoingRingbackTimer invalidate];
    hopeChatOutgoingRingbackTimer = nil;
    [hopeChatRingTimer invalidate];
    hopeChatRingTimer = nil;
    void (^tick)(void) = ^{
      AudioServicesPlaySystemSound(1315);
      AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    };
    tick();
    hopeChatRingTimer = [NSTimer scheduledTimerWithTimeInterval:2.2
                                                          repeats:YES
                                                            block:^(__unused NSTimer *timer) {
                                                              tick();
                                                            }];
    [[NSRunLoop mainRunLoop] addTimer:hopeChatRingTimer forMode:NSRunLoopCommonModes];
  });
}

RCT_EXPORT_METHOD(stopIncomingRingtone)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [hopeChatRingTimer invalidate];
    hopeChatRingTimer = nil;
    [hopeChatOutgoingRingbackTimer invalidate];
    hopeChatOutgoingRingbackTimer = nil;
  });
}

RCT_EXPORT_METHOD(startOutgoingRingback)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [hopeChatRingTimer invalidate];
    hopeChatRingTimer = nil;
    [hopeChatOutgoingRingbackTimer invalidate];
    hopeChatOutgoingRingbackTimer = nil;
    void (^pair)(void) = ^{
      AudioServicesPlaySystemSound(1315);
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.24 * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{
                       AudioServicesPlaySystemSound(1315);
                     });
    };
    pair();
    hopeChatOutgoingRingbackTimer =
        [NSTimer scheduledTimerWithTimeInterval:3.35
                                        repeats:YES
                                          block:^(__unused NSTimer *timer) {
                                            pair();
                                          }];
    [[NSRunLoop mainRunLoop] addTimer:hopeChatOutgoingRingbackTimer forMode:NSRunLoopCommonModes];
  });
}

RCT_EXPORT_METHOD(stopOutgoingRingback)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [hopeChatOutgoingRingbackTimer invalidate];
    hopeChatOutgoingRingbackTimer = nil;
  });
}

@end
