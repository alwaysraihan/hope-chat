#import <React/RCTBridgeModule.h>

@interface CrossAppAuthStorage : NSObject <RCTBridgeModule>
@end

@implementation CrossAppAuthStorage

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getSharedMMKVDirectorySync)
{
  NSFileManager *fm = NSFileManager.defaultManager;
  NSURL *groupURL = [fm containerURLForSecurityApplicationGroupIdentifier:@"group.com.hopenity.shared"];
  if (groupURL == nil) {
    return @"";
  }
  NSString *path = [[groupURL path] stringByAppendingPathComponent:@"mmkv-auth"];
  NSError *err = nil;
  [fm createDirectoryAtPath:path withIntermediateDirectories:YES attributes:nil error:&err];
  if (err != nil) {
    return @"";
  }
  return path;
}

@end
