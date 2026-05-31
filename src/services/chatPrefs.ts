import { createMMKV, type MMKV } from 'react-native-mmkv';

let _prefs: MMKV | null = null;
function prefs(): MMKV {
  if (!_prefs) _prefs = createMMKV({ id: 'hopechat-chat-prefs-v1' });
  return _prefs;
}

const K_E2EE = 'e2ee_enabled_v1';
const K_DIS_GLOBAL = 'disappear_global_sec_v1';
const K_APPEARANCE = 'chat_appearance_v1';
const K_LANG = 'ui_language_v1';
const K_AUTO_LOGIN_ACKED = 'auto_login_acked_v1';
const K_READ_RECEIPTS = 'read_receipts_v1';
const K_TYPING_INDICATOR = 'typing_indicator_v1';
const K_AUTO_SAVE_PHOTOS = 'auto_save_photos_v1';
const K_MSG_OPEN_TO = 'message_open_to_v1';
const K_DARK_MODE = 'dark_mode_v1';

// ─── Read Receipts ─────────────────────────────────────────────────────────────
export function getReadReceipts(): boolean {
  if (!prefs().contains(K_READ_RECEIPTS)) return true;
  return prefs().getBoolean(K_READ_RECEIPTS) !== false;
}
export function setReadReceipts(v: boolean): void {
  prefs().set(K_READ_RECEIPTS, v);
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────
export function getTypingIndicator(): boolean {
  if (!prefs().contains(K_TYPING_INDICATOR)) return true;
  return prefs().getBoolean(K_TYPING_INDICATOR) !== false;
}
export function setTypingIndicator(v: boolean): void {
  prefs().set(K_TYPING_INDICATOR, v);
}

// ─── Auto Save Photos ──────────────────────────────────────────────────────────
export function getAutoSavePhotos(): boolean {
  return prefs().getBoolean(K_AUTO_SAVE_PHOTOS) === true;
}
export function setAutoSavePhotos(v: boolean): void {
  prefs().set(K_AUTO_SAVE_PHOTOS, v);
}

// ─── Message Permissions ───────────────────────────────────────────────────────
export type MessageOpenTo = 'everyone' | 'contacts';
export function getMessageOpenTo(): MessageOpenTo {
  const v = prefs().getString(K_MSG_OPEN_TO);
  return v === 'contacts' ? 'contacts' : 'everyone';
}
export function setMessageOpenTo(v: MessageOpenTo): void {
  prefs().set(K_MSG_OPEN_TO, v);
}

// ─── Dark Mode ─────────────────────────────────────────────────────────────────
export function getDarkMode(): boolean {
  return prefs().getBoolean(K_DARK_MODE) === true;
}
export function setDarkMode(v: boolean): void {
  prefs().set(K_DARK_MODE, v);
}

/**
 * Set when the user taps "Continue as {name}" for the first time.
 * Allows subsequent cold-starts to skip the login screen entirely.
 * Cleared on logout so the confirmation is required again.
 */
export function isAutoLoginAcked(): boolean {
  return prefs().getBoolean(K_AUTO_LOGIN_ACKED) === true;
}
export function markAutoLoginAcked(): void {
  prefs().set(K_AUTO_LOGIN_ACKED, true);
}
export function clearAutoLoginAck(): void {
  prefs().delete(K_AUTO_LOGIN_ACKED);
}

export type AppLanguage = 'en' | 'bn';

export function getAppLanguage(): AppLanguage {
  const v = prefs().getString(K_LANG);
  return v === 'bn' ? 'bn' : 'en';
}

export function setAppLanguage(lang: AppLanguage): void {
  prefs().set(K_LANG, lang);
}

export const DEFAULT_REACTION_PALETTE = [
  '❤️',
  '😂',
  '😮',
  '😢',
  '👍',
  '🔥',
];

export type ChatAppearance = {
  themePresetId: number;
  wallpaperUri: string | null;
  accentHex: string | null;
  reactionEmojiPalette: string[];
};

const defaultAppearance = (): ChatAppearance => ({
  themePresetId: 1,
  wallpaperUri: null,
  accentHex: null,
  reactionEmojiPalette: [...DEFAULT_REACTION_PALETTE],
});

export function isE2eeEnabled(): boolean {
  if (!prefs().contains(K_E2EE)) return true;
  return prefs().getBoolean(K_E2EE) !== false;
}

export function setE2eeEnabled(v: boolean): void {
  prefs().set(K_E2EE, v);
}

function disappearKey(conversationId: string): string {
  return `disappear_sec_${conversationId}`;
}

export function getEffectiveDisappearingTtlSec(
  conversationId: string | undefined,
): number {
  if (!conversationId) {
    return Math.max(0, prefs().getNumber(K_DIS_GLOBAL) ?? 0);
  }
  if (prefs().contains(disappearKey(conversationId))) {
    return Math.max(0, prefs().getNumber(disappearKey(conversationId)) ?? 0);
  }
  return Math.max(0, prefs().getNumber(K_DIS_GLOBAL) ?? 0);
}

export function setDisappearingGlobal(seconds: number): void {
  prefs().set(K_DIS_GLOBAL, Math.max(0, seconds));
}

export function getDisappearingGlobalSeconds(): number {
  return Math.max(0, prefs().getNumber(K_DIS_GLOBAL) ?? 0);
}

export function getDisappearingOverrideSeconds(
  conversationId: string,
): number | undefined {
  const k = disappearKey(conversationId);
  if (!prefs().contains(k)) return undefined;
  return Math.max(0, prefs().getNumber(k) ?? 0);
}

export function setDisappearingForConversation(
  conversationId: string,
  seconds: number,
): void {
  const k = disappearKey(conversationId);
  if (seconds <= 0) prefs().remove(k);
  else prefs().set(k, seconds);
}

export function initialDisappearingTtlSec(
  conversationId: string | undefined,
): number {
  if (conversationId) {
    const o = getDisappearingOverrideSeconds(conversationId);
    if (o !== undefined) return o;
  }
  return getDisappearingGlobalSeconds();
}

export function getChatAppearance(): ChatAppearance {
  try {
    const raw = prefs().getString(K_APPEARANCE);
    if (!raw) return defaultAppearance();
    const j = JSON.parse(raw) as Partial<ChatAppearance>;
    return {
      ...defaultAppearance(),
      ...j,
      reactionEmojiPalette: Array.isArray(j.reactionEmojiPalette)
        ? j.reactionEmojiPalette.slice(0, 12)
        : defaultAppearance().reactionEmojiPalette,
    };
  } catch {
    return defaultAppearance();
  }
}

export function setChatAppearance(patch: Partial<ChatAppearance>): void {
  const next = { ...getChatAppearance(), ...patch };
  prefs().set(K_APPEARANCE, JSON.stringify(next));
}

export function getReactionPalette(): string[] {
  return getChatAppearance().reactionEmojiPalette.length > 0
    ? getChatAppearance().reactionEmojiPalette
    : DEFAULT_REACTION_PALETTE;
}
