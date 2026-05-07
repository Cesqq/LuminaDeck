// AppGroupBridge.m
//
// Obj-C bridge declaration that exposes the Swift `AppGroupBridge` class
// to the React Native JavaScript runtime. `RCT_EXTERN_MODULE` registers
// the module; each `RCT_EXTERN_METHOD` declaration mirrors the Swift
// `@objc` selector so RN knows how to dispatch.
//
// Copied into the main app target by the Ruby patch script alongside the
// Swift file.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupBridge, NSObject)

RCT_EXTERN_METHOD(write:(NSString *)groupId
                  key:(NSString *)key
                  json:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(read:(NSString *)groupId
                  key:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(remove:(NSString *)groupId
                  key:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return NO; }

@end
