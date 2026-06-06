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
