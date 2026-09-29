package com.hopechat

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType

class MainApplication : Application(), ReactApplication {

  companion object {
    /**
     * Pins resources that are only ever referenced by a raw string name from
     * JS (notifee's smallIcon/largeIcon options), e.g.
     * smallIcon: 'ic_stat_notification'. R8's resource shrinker (release
     * builds only — shrinkResources is off in debug) can't see into the
     * Hermes bundle to know those strings are used, so it silently stripped
     * these as dead resources, which crashed every notification with
     * "Invalid notification (no valid small icon)" on release only.
     * `tools:keep` in res/raw/keep.xml documents the same intent but did not
     * reliably stop the strip here, so this real bytecode reference —
     * unambiguous to the shrinker — is what actually pins them.
     */
    @Suppress("unused")
    private val keepNotificationResources =
      intArrayOf(
        R.drawable.ic_stat_notification,
        R.mipmap.ic_launcher,
        R.mipmap.ic_launcher_round,
      )
  }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(CrossAppAuthPackage())
        },
    )
  }

  override fun onCreate() {
    LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())
    super.onCreate()
    loadReactNative(this)
  }
}
