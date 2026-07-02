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
 *
 * UI: this module only decides WHICH prompt to show and emits
 * CALL_RELIABILITY_PROMPT_EVENT — <CallReliabilityPrompt /> (mounted from
 * IncomingCallListener) renders the branded modal and opens the right settings
 * screen when the user confirms.
 */
import { DeviceEventEmitter, Platform } from 'react-native';
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

export const CALL_RELIABILITY_PROMPT_EVENT =
  'hopechat:call_reliability_prompt_v1';

export type CallReliabilityPromptKind =
  | 'notifications'
  | 'battery'
  | 'power_manager';

export type CallReliabilityPromptPayload = {
  kind: CallReliabilityPromptKind;
  title: string;
  message: string;
};

/** Opens the settings screen that fixes the prompted issue. */
export async function openCallReliabilitySettings(
  kind: CallReliabilityPromptKind,
): Promise<void> {
  try {
    if (kind === 'notifications') await notifee.openNotificationSettings();
    else if (kind === 'battery') await notifee.openBatteryOptimizationSettings();
    else await notifee.openPowerManagerSettings();
  } catch {
    /* settings screen unavailable on this device — nothing else to do */
  }
}

function shouldPrompt(key: string): boolean {
  const lastAskedAt = store().getNumber(key);
  return lastAskedAt == null || Date.now() - lastAskedAt > REPROMPT_INTERVAL_MS;
}

function markPrompted(key: string): void {
  store().set(key, Date.now());
}

function emitPrompt(payload: CallReliabilityPromptPayload): void {
  DeviceEventEmitter.emit(CALL_RELIABILITY_PROMPT_EVENT, payload);
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
        emitPrompt({
          kind: 'notifications',
          title: 'Turn on notifications',
          message:
            'Notifications are off, so HopeChat can’t ring when the app is closed. Turn them on to never miss a call or message.',
        });
      }
      return; // one prompt per run
    }

    if (Platform.OS !== 'android') return;

    // ── 2. Battery optimization (stock Android) ───────────────────────────────
    const batteryOptimized = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimized && shouldPrompt(K_BATTERY_ASKED_AT)) {
      markPrompted(K_BATTERY_ASKED_AT);
      emitPrompt({
        kind: 'battery',
        title: 'Never miss a call',
        message:
          'Your phone’s battery saver can silence HopeChat calls when the app is closed. Allow HopeChat to run in the background so calls always ring — it barely uses any battery.',
      });
      return;
    }

    // ── 3. OEM power manager (Xiaomi / Huawei / Oppo / Vivo / Samsung…) ───────
    // Only reachable when battery optimization is already off, so users on
    // aggressive OEM skins get the vendor-specific auto-start screen next.
    const powerManagerInfo = await notifee.getPowerManagerInfo();
    if (powerManagerInfo.activity && shouldPrompt(K_BATTERY_ASKED_AT)) {
      markPrompted(K_BATTERY_ASKED_AT);
      emitPrompt({
        kind: 'power_manager',
        title: 'Never miss a call',
        message:
          'Your phone restricts apps in the background, which can stop HopeChat calls from ringing. Allow HopeChat to auto-start / run in the background so calls always come through.',
      });
    }
  } catch {
    /* reliability checks are best-effort — never break app startup */
  }
}
