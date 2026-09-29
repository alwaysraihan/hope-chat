//
//  hopeChat-Bridging-Header.h
//
//  RNCallKeep / RNVoipPushNotification are plain Objective-C CocoaPods with no
//  generated Clang module for this project's build configuration ("no such
//  module 'RNCallKeep'" when using `import RNCallKeep` from Swift). Importing
//  them here instead makes every symbol available to AppDelegate.swift without
//  going through the module system at all.
//

#import <RNCallKeep/RNCallKeep.h>
#import <RNVoipPushNotification/RNVoipPushNotificationManager.h>
