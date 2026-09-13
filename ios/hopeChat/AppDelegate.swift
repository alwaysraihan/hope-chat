import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import livekit_react_native
import RNBootSplash
import PushKit
// RNCallKeep / RNVoipPushNotification are exposed via hopeChat-Bridging-Header.h
// instead of `import` — see that file's header comment for why.

import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate, PKPushRegistryDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var voipRegistry: PKPushRegistry?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // React Native Firebase already configures the default app from
    // GoogleService-Info.plist; configuring twice raises an exception.
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }
    LivekitReactNative.setup()
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "hopeChat",
      in: window,
      launchOptions: launchOptions
    )

    // Register for VoIP push credentials as early as possible — a call can
    // arrive before the JS bridge is up, so this cannot wait for the RN side
    // to ask for it. `pushRegistry(_:didUpdatePushCredentials:for:)` below
    // fires once the token is ready and hands it to RNVoipPushNotification,
    // whose JS listener (see IncomingCallListener.tsx) forwards it to the
    // backend for storage alongside the regular FCM token.
    let registry = PKPushRegistry(queue: DispatchQueue.main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    voipRegistry = registry

    return true
  }

  // MARK: - PKPushRegistryDelegate

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(credentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // The system calls this when a previously issued token stops being valid.
    // No client action needed — the backend simply stops using it once a
    // fresh registration replaces it.
  }

  /**
   * Apple requires CallKit to be told about an incoming call SYNCHRONOUSLY,
   * before this method returns (or `completion()` is called) — skipping this,
   * or being late enough times, gets VoIP push delivery throttled or revoked
   * for the app. `uuid`/`callerName`/`handle` are whatever the backend's
   * call-invite payload put in the push (see the backend's direct-APNs VoIP
   * send path), not derived here.
   */
  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let dict = payload.dictionaryPayload
    let uuid = (dict["uuid"] as? String) ?? UUID().uuidString
    let callerName = (dict["callerName"] as? String) ?? "Incoming call"
    let handle = (dict["handle"] as? String) ?? callerName
    let hasVideo = (dict["hasVideo"] as? Bool) ?? false

    RNVoipPushNotificationManager.addCompletionHandler(uuid, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: handle,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: dict,
      withCompletionHandler: nil
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  @objc func customizeRootView(_ rootView: RCTRootView) {
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
