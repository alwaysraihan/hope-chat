/**
 * Call-reliability guard — detects the device-level settings that silently break
 * incoming calls when the app is backgrounded/killed, and walks the user through
 * fixing them (the same prompts WhatsApp/Telegram show):
 *
 *  1. Notifications disabled → Android cannot show the full-screen incoming-call
 *     UI from the background. (Foreground calls still work via socket.)
 *  2. Battery optimization → aggressive OEMs (Xiaomi, Oppo, Vivo, Samsung…)
 *     defer or drop the high-priority FCM data message that triggers the ring.
 *
 * Prompts are rate-limited so the user is reminded at most once per week per
 * issue, and never nagged again once the setting is fixed.
 */
import { Alert, Platform } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-call-reliability-v1' });
  return _store;
}

const K_NOTIFICATIONS_ASKED_AT = 'notifications_asked_at';
const K_BATTERY_ASKED_AT = 'battery_asked_at';
const REPROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function shouldPrompt(key: string): boolean {
  const lastAskedAt = store().getNumber(key);
  return lastAskedAt == null || Date.now() - lastAskedAt > REPROMPT_INTERVAL_MS;
}

function markPrompted(key: string): void {
  store().set(key, Date.now());
}

function confirmOpenSettings(title: string, message: string, onOpen: () => void): void {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open settings', onPress: onOpen },
  ]);
}

/**
 * Run once per app start (after login). Never throws; never blocks startup.
 * Shows at most ONE prompt per run so the user isn't stacked with alerts.
 */
export async function ensureCallReliability(): Promise<void> {
  try {
    // ── 1. Notification permission ────────────────────────────────────────────
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      if (shouldPrompt(K_NOTIFICATIONS_ASKED_AT)) {
        markPrompted(K_NOTIFICATIONS_ASKED_AT);
        confirmOpenSettings(
          'Turn on notifications for calls',
          'Notifications are off, so HopeChat cannot ring when the app is closed. ' +
            'Enable notifications to receive incoming calls like WhatsApp.',
          () => {
            void notifee.openNotificationSettings();
          },
        );
      }
      return; // one prompt per run
    }

    if (Platform.OS !== 'android') return;

    // ── 2. Battery optimization (stock Android) ───────────────────────────────
    const batteryOptimized = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimized && shouldPrompt(K_BATTERY_ASKED_AT)) {
      markPrompted(K_BATTERY_ASKED_AT);
      confirmOpenSettings(
        'Allow calls in the background',
        'Battery optimization can delay or block incoming calls when HopeChat is ' +
          'closed. Set HopeChat to "Unrestricted" / "Don\'t optimize" so calls always ring.',
        () => {
          void notifee.openBatteryOptimizationSettings();
        },
      );
      return;
    }

    // ── 3. OEM power manager (Xiaomi / Huawei / Oppo / Vivo / Samsung…) ───────
    // Only reachable when battery optimization is already off, so users on
    // aggressive OEM skins get the vendor-specific auto-start screen next.
    const powerManagerInfo = await notifee.getPowerManagerInfo();
    if (powerManagerInfo.activity && shouldPrompt(K_BATTERY_ASKED_AT)) {
      markPrompted(K_BATTERY_ASKED_AT);
      confirmOpenSettings(
        'Allow HopeChat to auto-start',
        'Your phone restricts apps in the background, which can stop incoming ' +
          'calls from ringing. Allow HopeChat to run in the background / auto-start.',
        () => {
          void notifee.openPowerManagerSettings();
        },
      );
    }
  } catch {
    /* reliability checks are best-effort — never break app startup */
  }
}
