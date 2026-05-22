package com.hopechat

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.io.File

/**
 * Resolves the MMKV storage directory for cross-app auth between HopeChat and Hopenity.
 *
 * NOTE: android:sharedUserId has been removed from both manifests (deprecated, Play Store
 * risk). createPackageContext() is retained as a best-effort probe: if the companion app is
 * installed on the same device and exposes a readable files directory it still works.
 * When that probe fails (typical after sharedUserId removal) the module returns "" and
 * hopenitySharedAuth.ts falls back to HopeChat's own private MMKV storage. Cold-start
 * auto-login from Hopenity will then rely on the deep-link / Intent handshake instead.
 *
 * TODO: Replace with a ContentProvider or signed-intent token-pass for a fully
 * sharedUserId-free cross-app auth path.
 */
@ReactModule(name = CrossAppAuthModule.NAME)
class CrossAppAuthModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Best-effort: returns a shared MMKV directory path when the companion package is
   * accessible via createPackageContext. Returns "" when the probe fails so the JS layer
   * can fall back to per-app private storage gracefully.
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getSharedMMKVDirectorySync(): String {
    return try {
      resolveSharedMmkvDir(reactApplicationContext).absolutePath
    } catch (e: Exception) {
      ""
    }
  }

  private fun resolveSharedMmkvDir(context: Context): File {
    // Probe companion packages. Without sharedUserId this will typically throw a
    // security exception; the catch block falls through to the per-app fallback.
    val packageCandidates = arrayOf("com.hopenity", "com.hopechat")
    for (pkg in packageCandidates) {
      try {
        val pkgCtx = context.createPackageContext(pkg, 0)
        val dir = File(pkgCtx.filesDir, "cross_app_mmkv")
        dir.mkdirs()
        if (dir.exists()) return dir
      } catch (_: Exception) {
        /* try next */
      }
    }
    val fallback = File(context.filesDir, "cross_app_mmkv")
    fallback.mkdirs()
    return fallback
  }

  companion object {
    const val NAME = "CrossAppAuthStorage"
  }
}
