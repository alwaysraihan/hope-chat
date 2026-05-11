package com.hopechat

import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = HopeChatCallRingtoneModule.NAME)
class HopeChatCallRingtoneModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  private var ringtone: Ringtone? = null

  private val mainHandler = Handler(Looper.getMainLooper())

  private var outgoingHandler: Handler? = null
  private var outgoingToneGen: ToneGenerator? = null

  private val outgoingRingRunnable =
    object : Runnable {
      override fun run() {
        val h = outgoingHandler ?: return
        val tg = outgoingToneGen ?: return
        try {
          tg.startTone(ToneGenerator.TONE_SUP_RINGTONE, 2200)
        } catch (_: Exception) {
          /* device may not support this tone type */
        }
        h.postDelayed(this, 2600)
      }
    }

  companion object {
    const val NAME = "HopeChatCallRingtone"
  }

  private fun stopIncomingRingtoneOnMainSync() {
    try {
      ringtone?.stop()
    } catch (_: Exception) {
      /* noop */
    } finally {
      ringtone = null
    }
  }

  private fun stopOutgoingRingbackOnMainSync() {
    outgoingHandler?.removeCallbacks(outgoingRingRunnable)
    outgoingHandler = null
    try {
      outgoingToneGen?.release()
    } catch (_: Exception) {
      /* noop */
    } finally {
      outgoingToneGen = null
    }
  }

  /** `ToneGenerator.Builder` is API 29+; use legacy ctor for consistent compile across AGP/SDK combos. */
  private fun createVoiceCallToneGenerator(): ToneGenerator? =
    try {
      @Suppress("DEPRECATION")
      ToneGenerator(AudioManager.STREAM_VOICE_CALL, 90)
    } catch (_: Exception) {
      null
    }

  @ReactMethod
  fun startIncomingRingtone() {
    mainHandler.post incomingWork@{
      stopOutgoingRingbackOnMainSync()
      stopIncomingRingtoneOnMainSync()
      try {
        var uri =
          RingtoneManager.getActualDefaultRingtoneUri(
            reactContext,
            RingtoneManager.TYPE_RINGTONE,
          )
        if (uri == null) {
          uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        }
        if (uri == null) {
          uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        }
        if (uri == null) return@incomingWork
        val rt = RingtoneManager.getRingtone(reactContext, uri) ?: return@incomingWork
        ringtone = rt
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          rt.audioAttributes =
            AudioAttributes
              .Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          rt.isLooping = true
        }
        rt.play()
      } catch (_: Exception) {
        /* noop */
      }
    }
  }

  @ReactMethod
  fun stopIncomingRingtone() {
    mainHandler.post {
      stopIncomingRingtoneOnMainSync()
      stopOutgoingRingbackOnMainSync()
    }
  }

  @ReactMethod
  fun startOutgoingRingback() {
    mainHandler.post outgoingWork@{
      stopOutgoingRingbackOnMainSync()
      stopIncomingRingtoneOnMainSync()
      val tg = createVoiceCallToneGenerator() ?: return@outgoingWork
      outgoingToneGen = tg
      val h = Handler(Looper.getMainLooper())
      outgoingHandler = h
      h.post(outgoingRingRunnable)
    }
  }

  @ReactMethod
  fun stopOutgoingRingback() {
    mainHandler.post { stopOutgoingRingbackOnMainSync() }
  }
}
