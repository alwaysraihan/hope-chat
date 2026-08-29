package com.hopechat

import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.atomic.AtomicReference

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
    private val pendingAutoAcceptJson = AtomicReference<String?>(null)
    private val pendingRejectJson     = AtomicReference<String?>(null)
  }

  @ReactMethod fun setPendingAutoAcceptData(json: String) { pendingAutoAcceptJson.set(json) }
  @ReactMethod fun consumePendingAutoAcceptData(promise: Promise) { promise.resolve(pendingAutoAcceptJson.getAndSet(null)) }

  /**
   * Hold the screen on for the duration of a video call.
   *
   * Uses FLAG_KEEP_SCREEN_ON on the activity window — the same mechanism every
   * video app uses. Done here rather than through react-native-keep-awake
   * because that package is unmaintained, its JS wrapper fails silently when the
   * module does not resolve, and a video call that lets the screen sleep is not
   * something that should depend on a third-party binding.
   *
   * The flag is tied to the window, so it is released automatically if the
   * activity is destroyed — a crashed call screen cannot leave the screen
   * pinned on.
   */
  @ReactMethod
  fun setKeepScreenOn(on: Boolean) {
    val activity = currentActivity ?: return
    // Window flags must be touched on the UI thread.
    activity.runOnUiThread {
      try {
        if (on) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      } catch (_: Exception) {
        /* never let a screen-wake preference crash a live call */
      }
    }
  }

  @ReactMethod fun setPendingRejectData(json: String) { pendingRejectJson.set(json) }
  @ReactMethod fun consumePendingRejectData(promise: Promise) { promise.resolve(pendingRejectJson.getAndSet(null)) }

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
