#import <AVFoundation/AVFoundation.h>

#import <React/RCTBridgeModule.h>

/**
 * Torch (flashlight) for the camera WebRTC is capturing from.
 *
 * The WebRTC module has no torch API, so we look up the live capture device via KVC:
 * WebRTCModule.localTracks → track.captureController (VideoCaptureController) → capturer
 * (RTCCameraVideoCapturer) → captureSession inputs. If that path ever changes we fall back to
 * any back camera with a torch. Setting torchMode while the session runs keeps video flowing.
 */
@interface HopeChatTorch : NSObject <RCTBridgeModule>
@end

@implementation HopeChatTorch

@synthesize moduleRegistry = _moduleRegistry;

RCT_EXPORT_MODULE(HopeChatTorch);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<AVCaptureDevice *> *)activeCaptureDevices:(NSString *)trackId
{
  NSMutableArray<AVCaptureDevice *> *out = [NSMutableArray array];
  @try {
    id webrtc = [_moduleRegistry moduleForName:"WebRTCModule"];
    NSDictionary *tracks = [webrtc valueForKey:@"localTracks"];
    for (NSString *tid in [tracks allKeys]) {
      if (trackId != nil && ![tid isEqualToString:trackId]) {
        continue;
      }
      id controller = [tracks[tid] valueForKey:@"captureController"];
      if (controller == nil || ![controller respondsToSelector:NSSelectorFromString(@"capturer")]) {
        continue;
      }
      id capturer = [controller valueForKey:@"capturer"];
      if (![capturer respondsToSelector:NSSelectorFromString(@"captureSession")]) {
        continue;
      }
      AVCaptureSession *session = [capturer valueForKey:@"captureSession"];
      for (AVCaptureInput *input in session.inputs) {
        if ([input isKindOfClass:[AVCaptureDeviceInput class]]) {
          AVCaptureDevice *device = ((AVCaptureDeviceInput *)input).device;
          if ([device hasMediaType:AVMediaTypeVideo]) {
            [out addObject:device];
          }
        }
      }
    }
  } @catch (NSException *e) {
    NSLog(@"[HopeChatTorch] could not reach WebRTC capture device: %@", e);
  }
  return out;
}

- (NSArray<AVCaptureDevice *> *)backTorchDevices
{
  AVCaptureDeviceDiscoverySession *discovery = [AVCaptureDeviceDiscoverySession
      discoverySessionWithDeviceTypes:@[ AVCaptureDeviceTypeBuiltInWideAngleCamera ]
                            mediaType:AVMediaTypeVideo
                             position:AVCaptureDevicePositionBack];
  NSMutableArray<AVCaptureDevice *> *out = [NSMutableArray array];
  for (AVCaptureDevice *device in discovery.devices) {
    if (device.hasTorch) {
      [out addObject:device];
    }
  }
  return out;
}

RCT_EXPORT_METHOD(isTorchAvailable : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  resolve(@([self backTorchDevices].count > 0));
}

RCT_EXPORT_METHOD(setTorch
                  : (BOOL)on trackId
                  : (NSString *)trackId resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)
{
  NSArray<AVCaptureDevice *> *devices = [self activeCaptureDevices:trackId];
  if (devices.count == 0) {
    devices = [self backTorchDevices];
  }
  BOOL anyOk = NO;
  NSError *lastError = nil;
  AVCaptureTorchMode mode = on ? AVCaptureTorchModeOn : AVCaptureTorchModeOff;
  for (AVCaptureDevice *device in devices) {
    if (!device.hasTorch || ![device isTorchModeSupported:mode]) {
      continue;
    }
    NSError *error = nil;
    if ([device lockForConfiguration:&error]) {
      device.torchMode = mode;
      [device unlockForConfiguration];
      anyOk = YES;
    } else {
      lastError = error;
    }
  }
  if (anyOk) {
    resolve(@YES);
  } else if (lastError != nil) {
    reject(@"torch_failed", lastError.localizedDescription, lastError);
  } else {
    reject(@"torch_unsupported", @"Camera has no torch", nil);
  }
}

@end
