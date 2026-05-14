package com.hopechat

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Bridges Android's "draw over other apps" (SYSTEM_ALERT_WINDOW) gate. We don't draw the bubble
 * here — we just gate the user through Settings so the JS layer can later render an overlay
 * Activity. Safe no-op on API < 23.
 */
@ReactModule(name = HopeChatOverlayPermissionModule.NAME)
class HopeChatOverlayPermissionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      promise.resolve(Settings.canDrawOverlays(reactContext))
    } catch (e: Exception) {
      promise.reject("overlay_check_failed", e)
    }
  }

  /**
   * Opens the system "Display over other apps" screen for this package. We can't await the user's
   * decision from JS — the JS side should re-check `hasOverlayPermission` on AppState 'active'.
   */
  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      if (Settings.canDrawOverlays(reactContext)) {
        promise.resolve(true)
        return
      }
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactContext.packageName}"),
      )
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("overlay_request_failed", e)
    }
  }

  companion object {
    const val NAME = "HopeChatOverlayPermission"
  }
}
