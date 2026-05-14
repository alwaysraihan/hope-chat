package com.hopechat

import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "hopeChat"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    allowShowOnLockScreenForCalls()
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(savedInstanceState)
    maybeRequestDismissKeyguard()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    maybeRequestDismissKeyguard()
  }

  override fun onResume() {
    super.onResume()
    maybeRequestDismissKeyguard()
  }

  /**
   * Lets the React incoming-call UI draw over the lock screen (WhatsApp-style), including when the
   * full-screen notification launches the activity.
   */
  private fun allowShowOnLockScreenForCalls() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
              WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
  }

  /**
   * Dismisses the keyguard (lock screen PIN/pattern overlay) so the call UI is fully interactive
   * without requiring the user to unlock first. Only effective on API 26+ when keyguard is locked.
   */
  private fun maybeRequestDismissKeyguard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val km = getSystemService(KEYGUARD_SERVICE) as? KeyguardManager ?: return
      if (km.isKeyguardLocked) {
        km.requestDismissKeyguard(this, null)
      }
    }
  }
}
