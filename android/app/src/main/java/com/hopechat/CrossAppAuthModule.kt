package com.hopechat

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.io.File

/**
 * CrossAppAuthModule — Android companion for cross-app MMKV auth sharing.
 *
 * ── Strategy ─────────────────────────────────────────────────────────────────
 *
 * iOS: the App Group container (group.com.hopenity.shared) is returned by the
 *   Objective-C counterpart so MMKV reads the shared file Hopenity wrote.
 *
 * Android: both apps declare `android:sharedUserId="com.hopenity.shared"` and
 *   are signed with the **same keystore**.  Under this configuration both
 *   processes run with the same Linux UID, which means:
 *
 *   1. `createPackageContext("com.hopenity", 0)` succeeds without SecurityException.
 *   2. `hopenityContext.filesDir` resolves to /data/data/com.hopenity/files —
 *      readable and writable by HopeChat because they share the same UID.
 *   3. MMKV created at <hopenityFilesDir>/mmkv/ with mode=MULTI_PROCESS will
 *      read the same encrypted file that Hopenity wrote.
 *
 * This mirrors the Facebook ↔ Messenger pattern on Android:
 *   - Hopenity writes its session to its own MMKV (the source of truth).
 *   - HopeChat reads from the same file via this shared path.
 *   - MMKV's MULTI_PROCESS mode handles concurrent read/write safely via
 *     file locking, so no data races occur when both apps are in the foreground.
 *
 * ── Fallback ─────────────────────────────────────────────────────────────────
 *
 * If Hopenity is not installed, `createPackageContext` throws NameNotFoundException.
 * We catch it and return "" so hopenitySharedAuth.ts falls back to HopeChat's
 * own private MMKV — the deep-link handshake (hopechat://auth?token=...) will
 * seed it on first launch from Hopenity as before.
 *
 * ── Requirements ─────────────────────────────────────────────────────────────
 *
 * 1. Both apps must declare the same android:sharedUserId in AndroidManifest.xml.
 * 2. Both APKs must be signed with the identical keystore / signing key.
 *    (Play Store: sharedUserId is deprecated for NEW apps but works for existing
 *    pairs that already use it.  For new installs, the deep-link fallback is used
 *    until the user opens HopeChat from Hopenity at least once.)
 */
@ReactModule(name = CrossAppAuthModule.NAME)
class CrossAppAuthModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getSharedMMKVDirectorySync(): String {
    return try {
      // createPackageContext succeeds when both apps share the same UID
      // (android:sharedUserId + identical signing key).
      val hopenityContext = reactApplicationContext.createPackageContext(
        "com.hopenity",
        0, // no flags — we only need the file paths, not code execution
      )
      val mmkvDir = File(hopenityContext.filesDir, "mmkv")
      // Ensure the directory exists so MMKV can open the file immediately.
      mmkvDir.mkdirs()
      mmkvDir.absolutePath
    } catch (_: Exception) {
      // Hopenity not installed, or sharedUserId / keystore mismatch.
      // Return "" → hopenitySharedAuth.ts falls back to per-app private MMKV
      // and the deep-link handshake seeds the session on first open.
      ""
    }
  }

  companion object {
    const val NAME = "CrossAppAuthStorage"
  }
}
