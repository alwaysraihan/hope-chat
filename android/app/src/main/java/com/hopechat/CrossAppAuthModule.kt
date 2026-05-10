package com.hopechat

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.io.File

/**
 * Android SharedUserId allows apps to share data directories.
 * With sharedUserId="com.hopenity.shared", both apps can access a shared MMKV directory.
 * This returns the shared files directory path for MMKV storage.
 */
@ReactModule(name = CrossAppAuthModule.NAME)
class CrossAppAuthModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Returns the shared MMKV directory path for Android apps with SharedUserId.
   * With sharedUserId="com.hopenity.shared", both hope-chat and hopenity can access
   * /data/data/com.hopenity.shared/ directory for shared storage.
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
    // Same path Hopenity + Hope Chat must resolve (paired apps, same signing key + sharedUserId).
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
