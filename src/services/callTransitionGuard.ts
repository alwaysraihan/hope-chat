/**
 * Suppresses old call screen's safePop when we intentionally swap screens
 * (mode switch audio↔video, or accepting a new incoming call over an existing one).
 *
 * Set this flag true before navigation.replace / CommonActions.reset, then reset
 * it after a short delay to allow the old screen's onDisconnected to fire harmlessly.
 */

let _transitioning = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

export function beginCallTransition(durationMs = 600): void {
  _transitioning = true;
  if (_timer !== null) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _transitioning = false;
    _timer = null;
  }, durationMs);
}

export function isCallTransitioning(): boolean {
  return _transitioning;
}
