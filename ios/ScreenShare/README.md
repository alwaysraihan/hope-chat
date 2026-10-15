# ScreenShare (iOS Broadcast Upload Extension)

iOS screen sharing in video calls. `@livekit/react-native-webrtc` can only capture
the whole screen through a ReplayKit broadcast extension, so:

1. `VideoCallScreen` opens the system broadcast sheet (`ScreenCapturePickerView`)
   with this extension preselected, then calls `setScreenShareEnabled(true)`.
2. The app listens on a Unix socket named `rtc_SSFD` in the App Group container
   (`RTCAppGroupIdentifier` in `hopeChat/Info.plist`).
3. When the user taps **Start Broadcast**, `SampleHandler` connects to the socket
   and `SampleUploader` sends every 3rd frame as a JPEG.
4. Stopping in the app closes the socket, which ends the broadcast. Stopping from
   the red status-bar pill or Control Center ends the track, and LiveKit
   unpublishes it.

| | App (`hopeChat`) | Extension (`ScreenShare`) |
|---|---|---|
| Bundle id | `com.hopechat` | `com.hopechat.ScreenShare` |
| App Group | `group.com.hopenity.shared` | `group.com.hopenity.shared` |
| Entitlements | `hopeChat/hopeChat.entitlements` | `ScreenShare/ScreenShare.entitlements` |

The App Group id is hardcoded in three places that must match:
`hopeChat/Info.plist`, `ScreenShare/Info.plist`, and `SampleHandler.swift`.
`RTCScreenSharingExtension` in `hopeChat/Info.plist` must equal the extension's
bundle id.

## Apple Developer portal setup (needed before a device or TestFlight build)

The simulator build needs none of this, but the simulator cannot run broadcast
extensions, so test on a real device.

Team: `M5KASSDH5L`.

1. **App Group**: in Certificates, Identifiers & Profiles → Identifiers →
   App Groups, make sure `group.com.hopenity.shared` exists. It should, because
   the app already uses it.
2. **New App ID for the extension**: Identifiers → **+** → App IDs → App.
   - Description: `Hopechat Screen Share`
   - Bundle ID (explicit): `com.hopechat.ScreenShare`
   - Capabilities: tick **App Groups**. Save.
   - Open the new id → App Groups → **Configure** → select
     `group.com.hopenity.shared` → Continue → Save.
3. **Main app id** `com.hopechat`: confirm App Groups is ticked and
   `group.com.hopenity.shared` is assigned. If you change it, existing profiles
   become invalid and must be regenerated.
4. **Provisioning profiles**:
   - With automatic signing in Xcode (the project's setting), open the
     `ScreenShare` target → Signing & Capabilities, pick team `M5KASSDH5L`, and
     Xcode creates the development profile. For archives, Xcode creates the
     distribution profile when you upload.
   - With manual signing or CI (fastlane match etc.), create **Development** and
     **App Store** profiles for `com.hopechat.ScreenShare` and add them next to
     the app's profiles. Every archive must sign both the app and the extension.
5. **Register test devices** in the development profile, if you use one.

## Testing

Use a real device, because ReplayKit broadcasts don't run in the Simulator.
Start a video call, tap the screen-share button, and choose
**Start Broadcast**. The other participant should see the screen after the
3-second countdown.
