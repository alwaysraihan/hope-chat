/**
 * Call-reliability guard — detects device-level settings that silently break
 * incoming calls when the app is backgrounded/killed.
 *
 * Only ONE condition prompts the user: notifications disabled — without them
 * Android cannot show the full-screen incoming-call UI from the background at
 * all, so there is no code-level workaround. (Foreground calls still work via
 * socket.)
 *
 * Battery-optimization / OEM power-manager prompts were deliberately REMOVED
 * (2026-07): they fired for nearly every user (battery optimization is on by
 * default on stock Android) and made the app feel broken. Call delivery in
 * background/killed state must instead rely on high-priority FCM data
 * messages + full-screen intent, which bypass standard doze/battery
 * optimization the same way WhatsApp does — do not reintroduce a nag here.
 *
 * The prompt is rate-limited to once per week and never shown again once the
 * setting is fixed.
 *
 * UI: this module only decides WHETHER to prompt and emits
 * CALL_RELIABILITY_PROMPT_EVENT — <CallReliabilityPrompt /> (mounted from
 * IncomingCallListener) renders the branded modal and opens the right settings
 * screen when the user confirms.
 */
import { DeviceEventEmitter, Linking } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-call-reliability-v1' });
  return _store;
}

const K_NOTIFICATIONS_ASKED_AT = 'notifications_asked_at';
const REPROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

export const CALL_RELIABILITY_PROMPT_EVENT =
  'hopechat:call_reliability_prompt_v1';

export type CallReliabilityPromptKind = 'notifications';

export type CallReliabilityPromptPayload = {
  kind: CallReliabilityPromptKind;
  title: string;
  message: string;
};

/** Opens the settings screen that fixes the prompted issue. */
export async function openCallReliabilitySettings(
  _kind: CallReliabilityPromptKind,
): Promise<void> {
  // Linking.openSettings() opens THIS app's own App-Info page, which always
  // has the Notifications toggle. notifee.openNotificationSettings() landed
  // some users on a system list where HopeChat wasn't shown at all.
  try {
    await Linking.openSettings();
  } catch {
    try {
      await notifee.openNotificationSettings();
    } catch {
      /* settings screen unavailable on this device — nothing else to do */
    }
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
 *
 * WhatsApp-style escalation — the branded modal is a LAST resort:
 *  1. Permission already granted → do nothing (the overwhelmingly common case).
 *  2. Not granted → silently trigger the normal OS permission dialog
 *     (notifee.requestPermission). Most users grant here and never see
 *     anything custom.
 *  3. Still denied after that (user hit "Don't allow" permanently, so the OS
 *     dialog can no longer appear) → only then show our branded prompt with a
 *     link to the app's settings page, at most once per week.
 */
export async function ensureCallReliability(): Promise<void> {
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus !== AuthorizationStatus.DENIED) return;

    // Step 2: the plain OS dialog. On Android 13+ / iOS this shows the native
    // permission sheet; if the user permanently denied earlier it resolves
    // immediately without showing anything.
    const requested = await notifee.requestPermission();
    if (requested.authorizationStatus !== AuthorizationStatus.DENIED) return;

    // Step 3: permanently denied — the only case that warrants our own modal.
    if (shouldPrompt(K_NOTIFICATIONS_ASKED_AT)) {
      markPrompted(K_NOTIFICATIONS_ASKED_AT);
      emitPrompt({
        kind: 'notifications',
        title: 'Turn on notifications',
        message:
          'Notifications are off, so HopeChat can’t ring when the app is closed. Turn them on to never miss a call or message.',
      });
    }
  } catch {
    /* reliability checks are best-effort — never break app startup */
  }
}
