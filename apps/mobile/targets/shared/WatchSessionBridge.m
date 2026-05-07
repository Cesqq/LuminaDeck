// WatchSessionBridge.m
//
// Obj-C bridge declaration that exposes the Swift `WatchSessionBridge`
// class to the React Native JavaScript runtime. The Swift class extends
// `RCTEventEmitter`, so we use `RCT_EXTERN_REMAP_MODULE` to register it
// as an event-emitter module that the JS side subscribes to via
// `NativeEventEmitter` / `DeviceEventEmitter`.
//
// Copied into the main app target by `scripts/ios-apply-native-targets.rb`.

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(WatchSessionBridge, RCTEventEmitter)

+ (BOOL)requiresMainQueueSetup { return NO; }

@end
