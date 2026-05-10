package com.hopechat

import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = HopeChatCallRingtoneModule.NAME)
class HopeChatCallRingtoneModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  private var ringtone: Ringtone? = null

  companion object {
    const val NAME = "HopeChatCallRingtone"
  }

  @ReactMethod
  fun startIncomingRingtone() {
    stopIncomingRingtone()
    try {
      val uri =
        RingtoneManager.getActualDefaultRingtoneUri(
          reactContext,
          RingtoneManager.TYPE_RINGTONE,
        )
          ?: return
      val rt = RingtoneManager.getRingtone(reactContext, uri) ?: return
      ringtone = rt
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        rt.isLooping = true
      }
      rt.play()
    } catch (_: Exception) {
      /* noop */
    }
  }

  @ReactMethod
  fun stopIncomingRingtone() {
    try {
      ringtone?.stop()
    } catch (_: Exception) {
      /* noop */
    } finally {
      ringtone = null
    }
  }
}
