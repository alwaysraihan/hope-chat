/**
 * LiveKitRoom invokes `onError` for connection failures and for publish/track errors.
 * Only the former should dismiss the call screen; media issues stay in-call with a notice.
 */
export function shouldDismissCallScreenOnLiveKitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as Error;
  if (e.name === 'ConnectionError') {
    return true;
  }
  const msg = String(e.message ?? '').toLowerCase();
  if (msg.includes('no livekit url')) {
    return true;
  }
  return false;
}
