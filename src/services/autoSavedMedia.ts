/**
 * Bookkeeping for "auto-save photos": which media this device has already
 * written to the gallery.
 *
 * Without it, auto-save re-downloaded and re-saved the same image every single
 * time its message was rendered — so opening a chat produced a burst of
 * downloads, a burst of toasts, and a duplicate gallery entry per pass (the
 * destination filename was `Date.now()`-based, so nothing ever collided).
 *
 * WhatsApp's behaviour is the target: save once, silently, and never mention it
 * again. Manual "Save to gallery" is unaffected — that stays loud and always
 * re-saves, because the user explicitly asked for it.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-autosaved-media-v1' });
  return _store;
}

/** In-flight guard: concurrent renders must not start the same download twice. */
const inFlight = new Set<string>();

function keyFor(remoteUrl: string): string {
  // The URL is the identity of the media. Query strings on signed CDN links can
  // change between fetches, so they are stripped — otherwise a re-signed link
  // would look like a brand new image and be saved again.
  const base = String(remoteUrl ?? '').split('?')[0].trim();
  return base;
}

export function hasAutoSaved(remoteUrl: string): boolean {
  const k = keyFor(remoteUrl);
  if (!k) return true; // nothing identifiable — never attempt
  try {
    return store().getBoolean(k) === true;
  } catch {
    // MMKV unavailable: claim it IS saved. Failing closed means we skip the
    // download; failing open would restore the infinite re-download loop.
    return true;
  }
}

export function markAutoSaved(remoteUrl: string): void {
  const k = keyFor(remoteUrl);
  if (!k) return;
  try {
    store().set(k, true);
  } catch {
    /* best-effort */
  }
}

/** True if this call claimed the download slot; false if one is already running. */
export function claimAutoSave(remoteUrl: string): boolean {
  const k = keyFor(remoteUrl);
  if (!k || inFlight.has(k)) return false;
  inFlight.add(k);
  return true;
}

export function releaseAutoSave(remoteUrl: string): void {
  inFlight.delete(keyFor(remoteUrl));
}
