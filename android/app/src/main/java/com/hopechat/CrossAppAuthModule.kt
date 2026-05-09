package com.hopechat

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Android cannot read another app's MMKV sandbox. This module keeps the same JS API as iOS;
 * shared directory is empty here — use backend tokens or a future ContentProvider in Hopenity.
 */
@ReactModule(name = CrossAppAuthModule.NAME)
class CrossAppAuthModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getSharedMMKVDirectorySync(): String = ""

  companion object {
    const val NAME = "CrossAppAuthStorage"
  }
}
