# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ── React Native native modules ───────────────────────────────────────────────
# R8 obfuscates class names in release builds, making NativeModules.* undefined.
# Keep all RN module classes and their @ReactMethod-annotated methods.
-keep class com.hopechat.CrossAppAuthModule { *; }
-keep class com.hopechat.CrossAppAuthPackage { *; }
-keep class com.hopechat.HopeChatCallRingtoneModule { *; }
-keep class com.hopechat.HopeChatOverlayPermissionModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepnames class * extends com.facebook.react.bridge.ReactContextBaseJavaModule

# ── MMKV ─────────────────────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }

# ── Android components (activities, services, providers, receivers) ──────────
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.content.BroadcastReceiver

# ── LiveKit / WebRTC (calls) ──────────────────────────────────────────────────
# JNI and reflection-based bridging to the native WebRTC engine — renaming
# anything here breaks call connect/media silently at runtime, not at build time.
-keep class org.webrtc.** { *; }
-keep class io.livekit.** { *; }
-keep class livekit.** { *; }
-dontwarn org.webrtc.**
-dontwarn io.livekit.**

# ── Firebase Messaging (push notifications) ───────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Notifee ────────────────────────────────────────────────────────────────────
-keep class app.notifee.** { *; }

# ── socket.io-client / okhttp (real-time signaling) ────────────────────────────
# socket.io-client parses server payloads via reflection into these; obfuscated
# field/class names desync the client from what the server actually sent.
-keep class io.socket.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn io.socket.**
-dontwarn okhttp3.**
-dontwarn okio.**

# ── react-native-video / ExoPlayer ─────────────────────────────────────────────
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# ── Gson / JSON models used across the above (reflection-based (de)serialization) ─
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
