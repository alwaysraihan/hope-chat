package com.hopechat

import android.content.Context
import android.hardware.Camera
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureRequest
import android.os.Handler
import android.util.Log
import android.util.Range
import android.view.Surface
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.oney.WebRTCModule.WebRTCModule
import java.lang.reflect.Field

/**
 * Torch (flashlight) for the camera WebRTC is capturing from.
 *
 * `CameraManager.setTorchMode` fails while a camera is open, and the WebRTC library has no torch
 * API, so we reach the live capture session by reflection:
 * WebRTCModule.getUserMediaImpl → tracks → TrackPrivate.videoCaptureController → videoCapturer
 * (CameraCapturer) → currentSession, then re-issue the same repeating request WebRTC's
 * Camera2Session builds in `onConfigured` with FLASH_MODE_TORCH added. The video track keeps
 * flowing — only the request changes, not the session.
 *
 * Any new camera session (switch camera, restartTrack, camera off/on, call end) builds a fresh
 * request without the flag, so the light goes out on its own; JS resets its state to match.
 *
 * Field names are checked against io.github.webrtc-sdk:android 144.7559.01 and
 * @livekit/react-native-webrtc 144.0.0. If an upgrade renames them, setTorch rejects
 * (`torch_unavailable`) instead of crashing.
 */
@ReactModule(name = HopeChatTorchModule.NAME)
class HopeChatTorchModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** True when a back-facing camera has a flash unit. */
  @ReactMethod
  fun isTorchAvailable(promise: Promise) {
    try {
      val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val available = manager.cameraIdList.any { id ->
        val c = manager.getCameraCharacteristics(id)
        c.get(CameraCharacteristics.LENS_FACING) == CameraMetadata.LENS_FACING_BACK &&
          c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }
      promise.resolve(available)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * Turns the torch on/off for the active camera capture. [trackId] narrows it to one local
   * track; null applies to every camera track (normally there is just one).
   */
  @ReactMethod
  fun setTorch(on: Boolean, trackId: String?, promise: Promise) {
    val sessions = try {
      findCameraSessions(trackId)
    } catch (e: Exception) {
      Log.w(TAG, "could not reach WebRTC camera session", e)
      promise.reject("torch_unavailable", e)
      return
    }
    if (sessions.isEmpty()) {
      promise.reject("torch_unavailable", "No active camera capture")
      return
    }
    // Every session runs on its own camera thread; apply there so we never race stop().
    var remaining = sessions.size
    var anyOk = false
    var lastError: Exception? = null
    val lock = Any()
    for ((session, handler) in sessions) {
      handler.post {
        val ok = try {
          applyTorch(session, on)
        } catch (e: Exception) {
          Log.w(TAG, "setTorch($on) failed", e)
          synchronized(lock) { lastError = e }
          false
        }
        synchronized(lock) {
          if (ok) anyOk = true
          remaining -= 1
          if (remaining == 0) {
            if (anyOk) promise.resolve(true)
            else if (lastError != null) promise.reject("torch_failed", lastError)
            else promise.reject("torch_unsupported", "Camera has no flash or is not running")
          }
        }
      }
    }
  }

  private fun findCameraSessions(trackId: String?): List<Pair<Any, Handler>> {
    val webrtc = reactContext.getNativeModule(WebRTCModule::class.java)
      ?: throw IllegalStateException("WebRTCModule not loaded")
    val gum = field(webrtc.javaClass, "getUserMediaImpl").get(webrtc)
      ?: throw IllegalStateException("getUserMediaImpl is null")
    val tracks = field(gum.javaClass, "tracks").get(gum) as Map<*, *>
    val out = ArrayList<Pair<Any, Handler>>()
    // GetUserMediaImpl mutates `tracks` only from its executor; copy before iterating.
    val entries = synchronized(tracks) { tracks.entries.toList() }
    for ((id, tp) in entries) {
      if (tp == null || (trackId != null && id != trackId)) continue
      val controller = field(tp.javaClass, "videoCaptureController").get(tp) ?: continue
      if (controller.javaClass.simpleName != "CameraCaptureController") continue
      val capturer = field(controller.javaClass, "videoCapturer").get(controller) ?: continue
      val session = field(capturer.javaClass, "currentSession").get(capturer) ?: continue
      val handler = field(session.javaClass, "cameraThreadHandler").get(session) as? Handler
        ?: continue
      out.add(session to handler)
    }
    return out
  }

  /** Runs on the session's camera thread. Returns false when there is nothing to light. */
  private fun applyTorch(session: Any, on: Boolean): Boolean {
    return when (session.javaClass.simpleName) {
      "Camera2Session" -> applyCamera2(session, on)
      "Camera1Session" -> applyCamera1(session, on)
      else -> false
    }
  }

  private fun applyCamera2(session: Any, on: Boolean): Boolean {
    val cls = session.javaClass
    if (field(cls, "state").get(session)?.toString() != "RUNNING") return false
    val chars = field(cls, "cameraCharacteristics").get(session) as? CameraCharacteristics
      ?: return false
    if (chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) != true) return false
    val captureSession = field(cls, "captureSession").get(session) as? CameraCaptureSession
      ?: return false
    val device = field(cls, "cameraDevice").get(session) as? CameraDevice ?: return false
    val surface = field(cls, "surface").get(session) as? Surface ?: return false
    val handler = field(cls, "cameraThreadHandler").get(session) as Handler
    val fpsUnitFactor = field(cls, "fpsUnitFactor").getInt(session)
    val format = field(cls, "captureFormat").get(session) ?: return false
    val framerate = field(format.javaClass, "framerate").get(format) ?: return false
    val fpsMin = field(framerate.javaClass, "min").getInt(framerate)
    val fpsMax = field(framerate.javaClass, "max").getInt(framerate)

    // Mirrors Camera2Session.CaptureSessionCallback.onConfigured, plus the flash mode.
    val builder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
    builder.set(
      CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
      Range(fpsMin / fpsUnitFactor, fpsMax / fpsUnitFactor),
    )
    builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
    builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
    chooseStabilization(chars, builder)
    chooseFocus(chars, builder)
    builder.set(
      CaptureRequest.FLASH_MODE,
      if (on) CaptureRequest.FLASH_MODE_TORCH else CaptureRequest.FLASH_MODE_OFF,
    )
    builder.addTarget(surface)
    captureSession.setRepeatingRequest(builder.build(), null, handler)
    return true
  }

  private fun chooseStabilization(chars: CameraCharacteristics, builder: CaptureRequest.Builder) {
    val optical = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION)
    if (optical?.contains(CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON) == true) {
      builder.set(
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_ON,
      )
      builder.set(
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF,
      )
      return
    }
    val video = chars.get(CameraCharacteristics.CONTROL_AVAILABLE_VIDEO_STABILIZATION_MODES)
    if (video?.contains(CameraMetadata.CONTROL_VIDEO_STABILIZATION_MODE_ON) == true) {
      builder.set(
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_ON,
      )
      builder.set(
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF,
      )
    }
  }

  private fun chooseFocus(chars: CameraCharacteristics, builder: CaptureRequest.Builder) {
    val modes = chars.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES)
    if (modes?.contains(CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_VIDEO) == true) {
      builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
    }
  }

  @Suppress("DEPRECATION")
  private fun applyCamera1(session: Any, on: Boolean): Boolean {
    val cls = session.javaClass
    if (field(cls, "state").get(session)?.toString() != "RUNNING") return false
    val camera = field(cls, "camera").get(session) as? Camera ?: return false
    val params = camera.parameters
    val wanted = if (on) Camera.Parameters.FLASH_MODE_TORCH else Camera.Parameters.FLASH_MODE_OFF
    if (params.supportedFlashModes?.contains(wanted) != true) return false
    params.flashMode = wanted
    camera.parameters = params
    return true
  }

  /** Finds a declared field on [start] or a superclass and makes it accessible. */
  private fun field(start: Class<*>, name: String): Field {
    var c: Class<*>? = start
    while (c != null) {
      try {
        return c.getDeclaredField(name).apply { isAccessible = true }
      } catch (e: NoSuchFieldException) {
        c = c.superclass
      }
    }
    throw NoSuchFieldException("${start.name}.$name")
  }

  companion object {
    const val NAME = "HopeChatTorch"
    private const val TAG = "HopeChatTorch"
  }
}
