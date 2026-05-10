package com.hopechat

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
      val context = reactApplicationContext
      // For SharedUserId, use a shared directory in the app's cache that can be accessed by other apps
      val sharedDir = File(context.filesDir.parent, "shared_mmkv")
      sharedDir.mkdirs()
      sharedDir.absolutePath
    } catch (e: Exception) {
      "" // Fallback if unable to create/access shared directory
    }
  }

  companion object {
    const val NAME = "CrossAppAuthStorage"
  }
}
